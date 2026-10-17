package com.orangesocial.security;

import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;

/**
 * AES-256-GCM para segredos guardados no banco (segredo TOTP). Formato: versão (1 byte) + IV (12) + cifra + tag.
 * O id do usuário entra como dado associado: o segredo de um usuário não decifra se for copiado para outro.
 */
@Component
public class SecretCipher {

    private static final byte VERSION = 1;
    private static final int IV_BYTES = 12;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final SecretKeySpec key;

    public SecretCipher(AppSecrets secrets) {
        this.key = new SecretKeySpec(secrets.derive("mfa-totp-v1"), "AES");
    }

    public byte[] encrypt(byte[] plain, long userId) {
        try {
            byte[] iv = new byte[IV_BYTES];
            RANDOM.nextBytes(iv);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
            c.updateAAD(aad(userId));
            byte[] sealed = c.doFinal(plain);
            return ByteBuffer.allocate(1 + IV_BYTES + sealed.length).put(VERSION).put(iv).put(sealed).array();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    public byte[] decrypt(byte[] blob, long userId) {
        try {
            ByteBuffer in = ByteBuffer.wrap(blob);
            if (in.get() != VERSION) {
                throw new IllegalStateException("Versão de cifra desconhecida");
            }
            byte[] iv = new byte[IV_BYTES];
            in.get(iv);
            byte[] sealed = new byte[in.remaining()];
            in.get(sealed);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, iv));
            c.updateAAD(aad(userId));
            return c.doFinal(sealed);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Segredo não pôde ser decifrado", e);
        }
    }

    private static byte[] aad(long userId) {
        return ByteBuffer.allocate(Long.BYTES).putLong(userId).array();
    }
}
