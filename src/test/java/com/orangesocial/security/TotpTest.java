package com.orangesocial.security;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class TotpTest {

    /** Vetores de teste da RFC 6238, apêndice B (SHA-1, 8 dígitos). */
    @Test
    void matchesRfc6238TestVectors() {
        byte[] secret = "12345678901234567890".getBytes(StandardCharsets.US_ASCII);
        assertThat(Totp.code(secret, Totp.stepAt(Instant.ofEpochSecond(59)), 8)).isEqualTo("94287082");
        assertThat(Totp.code(secret, Totp.stepAt(Instant.ofEpochSecond(1111111109)), 8)).isEqualTo("07081804");
        assertThat(Totp.code(secret, Totp.stepAt(Instant.ofEpochSecond(1234567890)), 8)).isEqualTo("89005924");
        assertThat(Totp.code(secret, Totp.stepAt(Instant.ofEpochSecond(2000000000)), 8)).isEqualTo("69279037");
    }

    @Test
    void acceptsOneStepOfClockDriftAndReportsTheStep() {
        byte[] secret = Totp.newSecret();
        Instant now = Instant.parse("2026-10-17T12:00:10Z");
        long step = Totp.stepAt(now);
        assertThat(Totp.verify(secret, Totp.code(secret, step - 1, 6), now)).hasValue(step - 1);
        assertThat(Totp.verify(secret, Totp.code(secret, step + 1, 6), now)).hasValue(step + 1);
        assertThat(Totp.verify(secret, Totp.code(secret, step - 2, 6), now)).isEmpty();
        assertThat(Totp.verify(secret, "12ab56", now)).isEmpty();
    }

    @Test
    void base32RoundTripAndOtpauthUri() {
        byte[] secret = Totp.newSecret();
        assertThat(Totp.fromBase32(Totp.base32(secret))).isEqualTo(secret);
        assertThat(Totp.base32(secret)).hasSize(32).matches("[A-Z2-7]+");
        assertThat(Totp.otpauthUri("Orange Social", "ana@example.com", secret))
                .startsWith("otpauth://totp/Orange%20Social%3Aana%40example.com?secret=")
                .endsWith("&issuer=Orange%20Social&algorithm=SHA1&digits=6&period=30");
    }

    @Test
    void cipherBindsSecretToTheUser() {
        AppSecrets secrets = new AppSecrets(java.util.Base64.getEncoder().encodeToString(new byte[32]),
                new org.springframework.mock.env.MockEnvironment());
        SecretCipher cipher = new SecretCipher(secrets);
        byte[] secret = Totp.newSecret();
        byte[] sealed = cipher.encrypt(secret, 7L);
        assertThat(cipher.decrypt(sealed, 7L)).isEqualTo(secret);
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> cipher.decrypt(sealed, 8L))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void absoluteTimeoutEndsOldSessionsOnTheServer() throws Exception {
        java.time.Clock clock = java.time.Clock.fixed(Instant.parse("2026-10-18T12:00:00Z"), java.time.ZoneOffset.UTC);
        AbsoluteSessionTimeoutFilter filter = new AbsoluteSessionTimeoutFilter(java.time.Duration.ofHours(24), clock);
        org.springframework.mock.web.MockHttpServletRequest old = new org.springframework.mock.web.MockHttpServletRequest();
        old.getSession().setAttribute(SessionService.AUTH_AT, Instant.parse("2026-10-17T11:59:00Z").toEpochMilli());
        var oldSession = old.getSession();
        filter.doFilter(old, new org.springframework.mock.web.MockHttpServletResponse(), new org.springframework.mock.web.MockFilterChain());
        assertThat(((org.springframework.mock.web.MockHttpSession) oldSession).isInvalid()).isTrue();

        org.springframework.mock.web.MockHttpServletRequest fresh = new org.springframework.mock.web.MockHttpServletRequest();
        fresh.getSession().setAttribute(SessionService.AUTH_AT, Instant.parse("2026-10-18T08:00:00Z").toEpochMilli());
        filter.doFilter(fresh, new org.springframework.mock.web.MockHttpServletResponse(), new org.springframework.mock.web.MockFilterChain());
        assertThat(((org.springframework.mock.web.MockHttpSession) fresh.getSession()).isInvalid()).isFalse();
    }
}
