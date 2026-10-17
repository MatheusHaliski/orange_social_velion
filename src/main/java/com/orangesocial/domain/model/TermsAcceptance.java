package com.orangesocial.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * Aceite de um documento legal da Velion (tabela {@code terms_acceptance}, append-only).
 * Base legal: execução de contrato (LGPD Art. 7º, V) — não é consentimento, por isso fica fora de
 * {@code consent_event}.
 */
@Entity
@Table(name = "terms_acceptance")
public class TermsAcceptance {

    public static final String TERMS_OF_USE = "TERMS_OF_USE";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private Long userId;

    @Column(name = "document", nullable = false, updatable = false)
    private String document;

    @Column(name = "version", nullable = false, updatable = false)
    private String version;

    @Column(name = "accepted_at", nullable = false, updatable = false)
    private Instant acceptedAt;

    @Column(name = "channel", nullable = false, updatable = false)
    private String channel;

    @Column(name = "ip_hash", updatable = false)
    private String ipHash;

    protected TermsAcceptance() {
        // JPA
    }

    public TermsAcceptance(Long userId, String document, String version, String channel, String ipHash) {
        this.userId = userId;
        this.document = document;
        this.version = version;
        this.channel = channel;
        this.ipHash = ipHash;
    }

    @PrePersist
    void onCreate() {
        acceptedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public String getDocument() {
        return document;
    }

    public String getVersion() {
        return version;
    }

    public Instant getAcceptedAt() {
        return acceptedAt;
    }

    public String getChannel() {
        return channel;
    }

    public String getIpHash() {
        return ipHash;
    }
}
