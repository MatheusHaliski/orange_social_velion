package com.orangesocial.application.account;

import com.orangesocial.domain.model.AccountStatus;
import com.orangesocial.domain.model.UserControlList;
import com.orangesocial.infrastructure.persistence.postgres.UserControlListRepository;
import com.orangesocial.security.AppSecrets;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.util.Map;

/**
 * Código de 6 dígitos enviado ao e-mail (RF1): vale 30 min e 5 tentativas; reenvio no máximo 1 por minuto.
 * No Valkey só fica o HMAC do código. Confirmar leva a conta de PENDING_VERIFICATION para ACTIVE.
 */
@Service
public class EmailVerificationService {

    static final Duration CODE_TTL = Duration.ofMinutes(30);
    static final Duration RESEND_INTERVAL = Duration.ofMinutes(1);
    static final int MAX_ATTEMPTS = 5;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final StringRedisTemplate redis;
    private final AppSecrets secrets;
    private final AccountNotifier notifier;
    private final UserControlListRepository users;
    private final Clock clock;

    public EmailVerificationService(StringRedisTemplate redis, AppSecrets secrets, AccountNotifier notifier,
                                    UserControlListRepository users, Clock clock) {
        this.redis = redis;
        this.secrets = secrets;
        this.notifier = notifier;
        this.users = users;
        this.clock = clock;
    }

    public void issue(UserControlList user) {
        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        String key = key(user.getId());
        redis.delete(key);
        redis.opsForHash().putAll(key, Map.of("h", digest(user.getId(), code), "a", "0"));
        redis.expire(key, CODE_TTL);
        redis.opsForValue().set(key + ":sent", "1", RESEND_INTERVAL);
        notifier.verificationCode(user, code);
    }

    public void resend(long userId) {
        UserControlList user = users.findById(userId).orElseThrow();
        if (user.getAccountStatus() != AccountStatus.PENDING_VERIFICATION) {
            throw new AccountExceptions.Conflict("Seu e-mail já está confirmado.");
        }
        if (Boolean.TRUE.equals(redis.hasKey(key(userId) + ":sent"))) {
            throw new AccountExceptions.TooManyAttempts(RESEND_INTERVAL);
        }
        issue(user);
    }

    @Transactional
    public void confirm(long userId, String code) {
        UserControlList user = users.findById(userId).orElseThrow();
        if (user.getAccountStatus() != AccountStatus.PENDING_VERIFICATION) {
            throw new AccountExceptions.Conflict("Seu e-mail já está confirmado.");
        }
        String key = key(userId);
        Object stored = redis.opsForHash().get(key, "h");
        if (stored == null) {
            throw new AccountExceptions.Invalid("O código expirou. Peça um novo.");
        }
        long attempts = redis.opsForHash().increment(key, "a", 1);
        boolean ok = code != null && code.strip().matches("\\d{6}") && MessageDigest.isEqual(
                stored.toString().getBytes(StandardCharsets.US_ASCII),
                digest(userId, code.strip()).getBytes(StandardCharsets.US_ASCII));
        if (!ok) {
            if (attempts >= MAX_ATTEMPTS) {
                redis.delete(key);
                throw new AccountExceptions.Invalid("Código incorreto. Peça um novo código.");
            }
            throw new AccountExceptions.Invalid("Código incorreto. Restam " + (MAX_ATTEMPTS - attempts) + " tentativas.");
        }
        redis.delete(key);
        user.markEmailVerified(clock.instant());
    }

    private String digest(long userId, String code) {
        return secrets.fingerprint("email-code", userId + ":" + code);
    }

    private static String key(long userId) {
        return "auth:verify:" + userId;
    }
}
