package com.orangesocial.application.account;

import com.orangesocial.application.account.AccountViews.MfaSetupView;
import com.orangesocial.application.account.AccountViews.MfaStatusView;
import com.orangesocial.application.account.AccountViews.RecoveryCodesView;
import com.orangesocial.domain.model.RecoveryCode;
import com.orangesocial.domain.model.UserControlList;
import com.orangesocial.infrastructure.persistence.postgres.RecoveryCodeRepository;
import com.orangesocial.infrastructure.persistence.postgres.UserControlListRepository;
import com.orangesocial.infrastructure.persistence.postgres.UserMfaRepository;
import com.orangesocial.security.SecretCipher;
import com.orangesocial.security.Totp;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.Serializable;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.OptionalLong;

/**
 * 2FA por app autenticador (docs/PESQUISA_DADOS_USUARIO.md §5): ativar (QR → confirmar com código → 10 códigos
 * de recuperação), verificar no login (TOTP com anti-replay ou código de recuperação de uso único), gerar novos
 * códigos e desativar — essas duas últimas exigem senha + código (modo sudo, {@link StepUp}).
 */
@Service
public class MfaService {

    public static final String ISSUER = "Orange Social";
    static final String SETUP_ATTRIBUTE = "orange.mfa.setup";
    static final Duration SETUP_TTL = Duration.ofMinutes(10);
    static final int RECOVERY_CODES = 10;
    /** Sem caracteres ambíguos (i, l, o, u, 0, 1). */
    private static final String RECOVERY_ALPHABET = "23456789abcdefghjkmnpqrstvwxyz";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserMfaRepository mfa;
    private final RecoveryCodeRepository recovery;
    private final UserControlListRepository users;
    private final SecretCipher cipher;
    private final PasswordEncoder hasher;
    private final AccountNotifier notifier;
    private final Clock clock;

    public MfaService(UserMfaRepository mfa, RecoveryCodeRepository recovery, UserControlListRepository users,
                      SecretCipher cipher, PasswordEncoder hasher, AccountNotifier notifier, Clock clock) {
        this.mfa = mfa;
        this.recovery = recovery;
        this.users = users;
        this.cipher = cipher;
        this.hasher = hasher;
        this.notifier = notifier;
        this.clock = clock;
    }

    record PendingSetup(byte[] secret, Instant expiresAt) implements Serializable {
    }

    @Transactional(readOnly = true)
    public boolean isEnabled(long userId) {
        return mfa.existsById(userId);
    }

    @Transactional(readOnly = true)
    public MfaStatusView status(long userId) {
        return mfa.findById(userId)
                .map(m -> new MfaStatusView(true, m.getEnabledAt(), recovery.countByUserIdAndUsedAtIsNull(userId)))
                .orElse(new MfaStatusView(false, null, 0));
    }

    /** Passo 1: gera o segredo e guarda na sessão (no servidor) até a confirmação. */
    public MfaSetupView startSetup(long userId, HttpSession session) {
        if (isEnabled(userId)) {
            throw new AccountExceptions.Conflict("O 2FA já está ativo. Desative antes de configurar outro aparelho.");
        }
        UserControlList user = users.findById(userId).orElseThrow();
        byte[] secret = Totp.newSecret();
        Instant expires = clock.instant().plus(SETUP_TTL);
        session.setAttribute(SETUP_ATTRIBUTE, new PendingSetup(secret, expires));
        return new MfaSetupView(Totp.base32(secret), Totp.otpauthUri(ISSUER, user.getEmail(), secret), ISSUER,
                user.getEmail(), expires);
    }

    /** Passo 2: o código do app prova que o segredo foi salvo; só então o 2FA liga. */
    @Transactional
    public RecoveryCodesView confirmSetup(long userId, String code, HttpSession session) {
        if (!(session.getAttribute(SETUP_ATTRIBUTE) instanceof PendingSetup pending)
                || clock.instant().isAfter(pending.expiresAt())) {
            throw new AccountExceptions.Invalid("A configuração expirou. Comece de novo.");
        }
        OptionalLong step = Totp.verify(pending.secret(), code == null ? null : code.strip(), clock.instant());
        if (step.isEmpty()) {
            throw new AccountExceptions.Invalid("Código incorreto. Confira a hora do celular e tente de novo.");
        }
        session.removeAttribute(SETUP_ATTRIBUTE);
        // outra configuração (em outra sessão) pode ter ligado o 2FA depois do startSetup: não sobrescreve o fator ativo
        if (mfa.enableIfAbsent(userId, cipher.encrypt(pending.secret(), userId), step.getAsLong()) == 0) {
            throw new AccountExceptions.Conflict("O 2FA já está ativo. Desative antes de configurar outro aparelho.");
        }
        notifier.mfaChanged(users.findById(userId).orElseThrow(), true);
        return newRecoveryCodes(userId);
    }

    /** Login e modo sudo: código de 6 dígitos do app ou um código de recuperação ainda não usado. */
    @Transactional
    public boolean verify(long userId, String code) {
        if (code == null || code.isBlank()) {
            return false;
        }
        String clean = code.strip().replace(" ", "");
        if (clean.matches("\\d{6}")) {
            return mfa.findById(userId).map(m -> {
                OptionalLong step = Totp.verify(cipher.decrypt(m.getTotpSecret(), userId), clean, clock.instant());
                return step.isPresent() && mfa.consumeStep(userId, step.getAsLong()) == 1;
            }).orElse(false);
        }
        String normalized = clean.toLowerCase(Locale.ROOT).replace("-", "");
        for (RecoveryCode rc : recovery.findByUserIdAndUsedAtIsNull(userId)) {
            if (hasher.matches(normalized, rc.getCodeHash())) {
                return recovery.markUsed(rc.getId(), clock.instant()) == 1;
            }
        }
        return false;
    }

    @Transactional
    public RecoveryCodesView regenerateRecoveryCodes(long userId) {
        if (!isEnabled(userId)) {
            throw new AccountExceptions.Conflict("Ative o 2FA primeiro.");
        }
        return newRecoveryCodes(userId);
    }

    @Transactional
    public void disable(long userId) {
        mfa.deleteById(userId);
        recovery.deleteAllOf(userId);
        notifier.mfaChanged(users.findById(userId).orElseThrow(), false);
    }

    private RecoveryCodesView newRecoveryCodes(long userId) {
        recovery.deleteAllOf(userId);
        List<String> codes = new ArrayList<>();
        for (int i = 0; i < RECOVERY_CODES; i++) {
            StringBuilder sb = new StringBuilder();
            for (int c = 0; c < 10; c++) {
                sb.append(RECOVERY_ALPHABET.charAt(RANDOM.nextInt(RECOVERY_ALPHABET.length())));
            }
            String code = sb.toString();
            recovery.save(new RecoveryCode(userId, hasher.encode(code)));
            codes.add(code.substring(0, 5) + "-" + code.substring(5));
        }
        return new RecoveryCodesView(codes, clock.instant());
    }
}
