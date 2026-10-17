package com.orangesocial.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Segredo mestre da aplicação ({@code ORANGE_APP_SECRET}, Base64, ≥ 32 bytes) e as chaves derivadas dele por
 * finalidade (HMAC-SHA256): cifra do segredo TOTP, impressão digital de IP e de e-mail nos contadores do Valkey.
 *
 * <p>Fica fora do banco e do repositório (Secrets Manager/Vault em produção). Sem ele a aplicação não sobe,
 * exceto nos perfis {@code dev} e {@code it}, que usam um segredo efêmero — o 2FA ativado nesses perfis não
 * sobrevive a um restart. Migração planejada para Tink + KMS com DEK por usuário (OS-46).
 */
@Component
public class AppSecrets {

    private static final Logger log = LoggerFactory.getLogger(AppSecrets.class);

    private final byte[] master;

    public AppSecrets(@Value("${orange-social.security.app-secret:}") String secret, Environment env) {
        if (secret == null || secret.isBlank()) {
            if (!env.matchesProfiles("dev | it")) {
                throw new IllegalStateException(
                        "Defina ORANGE_APP_SECRET (Base64, 32+ bytes): sem ele o 2FA e os hashes de IP não funcionam.");
            }
            master = new byte[32];
            new SecureRandom().nextBytes(master);
            log.warn("ORANGE_APP_SECRET ausente: segredo efêmero (perfil dev/it). O 2FA não sobrevive a restart.");
        } else {
            master = Base64.getDecoder().decode(secret.strip());
            if (master.length < 32) {
                throw new IllegalStateException("ORANGE_APP_SECRET precisa ter pelo menos 32 bytes.");
            }
        }
    }

    /** Chave de 32 bytes para uma finalidade, ex.: {@code derive("mfa-totp-v1")}. */
    public byte[] derive(String purpose) {
        return hmac(master, "orange-social/" + purpose);
    }

    /** HMAC em hexadecimal (IP, e-mail): irreversível sem o segredo, ao contrário de SHA-256 puro de um IPv4. */
    public String fingerprint(String purpose, String value) {
        return HexFormat.of().formatHex(hmac(derive(purpose), value == null ? "" : value));
    }

    private static byte[] hmac(byte[] key, String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }
}
