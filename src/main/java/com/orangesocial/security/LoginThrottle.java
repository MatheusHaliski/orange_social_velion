package com.orangesocial.security;

import com.orangesocial.application.account.AccountExceptions.TooManyAttempts;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;

/**
 * Limite de tentativas no Valkey (docs/PESQUISA_DADOS_USUARIO.md §6):
 * <ul>
 *   <li>por conta: a partir da 5ª falha em 15 min, espera progressiva de 1, 2, 4, 8… s até 15 min;</li>
 *   <li>por IP: 20 tentativas por minuto e 100 por hora.</li>
 * </ul>
 * As chaves usam HMAC do e-mail e do IP: o Valkey nunca vê o dado em claro. Nada é bloqueado para sempre:
 * a recuperação de senha continua disponível.
 */
@Component
public class LoginThrottle {

    static final int FREE_FAILURES = 4;
    static final Duration FAILURE_WINDOW = Duration.ofMinutes(15);
    static final Duration MAX_DELAY = Duration.ofMinutes(15);

    private final StringRedisTemplate redis;
    private final AppSecrets secrets;
    private final Clock clock;
    private final int perIpMinute;
    private final int perIpHour;

    public LoginThrottle(StringRedisTemplate redis, AppSecrets secrets, Clock clock,
                         @Value("${orange-social.security.login.per-ip-minute:20}") int perIpMinute,
                         @Value("${orange-social.security.login.per-ip-hour:100}") int perIpHour) {
        this.redis = redis;
        this.secrets = secrets;
        this.clock = clock;
        this.perIpMinute = perIpMinute;
        this.perIpHour = perIpHour;
    }

    /** Chamado antes de conferir a senha. Conta a tentativa do IP e respeita a espera da conta. */
    public void beforeAttempt(String account, String ipHash) {
        String ip = "auth:ip:" + ipHash;
        long minute = increment(ip + ":m", Duration.ofMinutes(1));
        long hour = increment(ip + ":h", Duration.ofHours(1));
        if (minute > perIpMinute) {
            throw new TooManyAttempts(ttl(ip + ":m"));
        }
        if (hour > perIpHour) {
            throw new TooManyAttempts(ttl(ip + ":h"));
        }
        String until = redis.opsForValue().get(key(account) + ":until");
        if (until != null) {
            long waitMs = Long.parseLong(until) - clock.millis();
            if (waitMs > 0) {
                throw new TooManyAttempts(Duration.ofMillis(waitMs));
            }
        }
    }

    public void onFailure(String account) {
        long failures = increment(key(account) + ":fails", FAILURE_WINDOW);
        if (failures > FREE_FAILURES) {
            long seconds = Math.min(1L << Math.min(failures - FREE_FAILURES - 1, 20), MAX_DELAY.toSeconds());
            redis.opsForValue().set(key(account) + ":until", Long.toString(clock.millis() + seconds * 1000),
                    Duration.ofSeconds(seconds));
        }
    }

    public void onSuccess(String account) {
        redis.delete(java.util.List.of(key(account) + ":fails", key(account) + ":until"));
    }

    private String key(String account) {
        return "auth:acct:" + secrets.fingerprint("login", account);
    }

    private long increment(String key, Duration ttl) {
        Long n = redis.opsForValue().increment(key);
        if (n != null && n == 1) {
            redis.expire(key, ttl);
        }
        return n == null ? 0 : n;
    }

    private Duration ttl(String key) {
        Long s = redis.getExpire(key);
        return Duration.ofSeconds(s == null || s < 1 ? 60 : s);
    }
}
