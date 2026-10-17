package com.orangesocial.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;

/** 2FA por app autenticador (tabela {@code user_mfa}). O segredo TOTP fica cifrado (AES-256-GCM). */
@Entity
@Table(name = "user_mfa")
public class UserMfa {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "totp_secret", nullable = false)
    private byte[] totpSecret;

    @Column(name = "enabled_at", nullable = false, updatable = false)
    private Instant enabledAt;

    /** Último passo de 30 s aceito: o mesmo código não vale duas vezes (anti-replay). */
    @Column(name = "last_used_step", nullable = false)
    private long lastUsedStep;

    protected UserMfa() {
        // JPA
    }

    public UserMfa(Long userId, byte[] encryptedSecret) {
        this.userId = userId;
        this.totpSecret = encryptedSecret;
    }

    @PrePersist
    void onCreate() {
        enabledAt = Instant.now();
    }

    /** Aceita o passo só se for posterior ao último usado. */
    public boolean consumeStep(long step) {
        if (step <= lastUsedStep) {
            return false;
        }
        lastUsedStep = step;
        return true;
    }

    public Long getUserId() {
        return userId;
    }

    public byte[] getTotpSecret() {
        return totpSecret;
    }

    public Instant getEnabledAt() {
        return enabledAt;
    }

    public long getLastUsedStep() {
        return lastUsedStep;
    }
}
