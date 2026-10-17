package com.orangesocial.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/** Comentário na caixa de mensagens do post (tabela {@code post_comment}). */
@Entity
@Table(name = "post_comment")
public class PostComment {

    public static final int MAX_LENGTH = 2000;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "post_id", nullable = false, updatable = false)
    private UUID postId;

    @Column(name = "author_user_id", nullable = false, updatable = false)
    private Long authorUserId;

    @Column(name = "body", length = MAX_LENGTH)
    private String body;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private CommentStatus status = CommentStatus.VISIBLE;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "removed_at")
    private Instant removedAt;

    protected PostComment() {
        // JPA
    }

    public PostComment(UUID postId, Long authorUserId, String body) {
        String trimmed = body == null ? "" : body.strip();
        if (trimmed.isEmpty()) {
            throw new IllegalArgumentException("O comentário não pode ficar vazio.");
        }
        if (trimmed.length() > MAX_LENGTH) {
            throw new IllegalArgumentException("O comentário passa de " + MAX_LENGTH + " caracteres.");
        }
        this.postId = postId;
        this.authorUserId = authorUserId;
        this.body = trimmed;
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now().truncatedTo(ChronoUnit.MICROS);
    }

    /** Remoção lógica: apaga o texto e mantém o id para auditoria de moderação. */
    public void remove() {
        if (status == CommentStatus.REMOVED) {
            return;
        }
        status = CommentStatus.REMOVED;
        body = null;
        removedAt = Instant.now().truncatedTo(ChronoUnit.MICROS);
    }

    public boolean isVisible() {
        return status == CommentStatus.VISIBLE;
    }

    /** Pode remover: quem escreveu ou o dono do post (moderação da própria caixa). */
    public boolean canBeRemovedBy(Long userId, Post post) {
        return authorUserId.equals(userId) || post.isAuthoredBy(userId);
    }

    public Long getId() {
        return id;
    }

    public UUID getPostId() {
        return postId;
    }

    public Long getAuthorUserId() {
        return authorUserId;
    }

    public String getBody() {
        return body;
    }

    public CommentStatus getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getRemovedAt() {
        return removedAt;
    }
}
