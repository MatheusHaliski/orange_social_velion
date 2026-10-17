package com.orangesocial.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import jakarta.persistence.Version;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.data.domain.Persistable;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Objects;
import java.util.UUID;

/**
 * Registro canônico do post (tabela {@code post}). A timeline do Cassandra é só projeção.
 *
 * <p>Os contadores são somente leitura para o JPA ({@code insertable = false, updatable = false}):
 * quem os altera é o {@code PostInteractionService}, com UPDATE atômico na mesma transação da
 * interação. Assim uma entidade carregada antes nunca sobrescreve um contador mais novo.
 */
@Entity
@Table(name = "post")
public class Post implements Persistable<UUID> {

    public static final String REMOVED_TITLE = "Conteúdo removido";

    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "author_user_id", nullable = false, updatable = false)
    private Long authorUserId;

    /** Categoria do autor copiada na publicação (filtro por cor sem join). */
    @Enumerated(EnumType.STRING)
    @Column(name = "author_user_type", nullable = false, updatable = false)
    private UserCategoryEnum authorUserType;

    @Enumerated(EnumType.STRING)
    @Column(name = "feed_type", nullable = false)
    private FeedType feedType;

    @Enumerated(EnumType.STRING)
    @Column(name = "media_type", nullable = false)
    private MediaType mediaType = MediaType.TEXT;

    @NotBlank
    @Size(max = 140)
    @Column(name = "title", nullable = false, length = 140)
    private String title;

    @Size(max = 280)
    @Column(name = "subtitle", length = 280)
    private String subtitle;

    @Column(name = "body")
    private String body;

    @Column(name = "media_object_key", length = 512)
    private String mediaObjectKey;

    @Column(name = "duration_seconds")
    private Integer durationSeconds;

    @Enumerated(EnumType.STRING)
    @Column(name = "age_rating", nullable = false)
    private AgeRating ageRating = AgeRating.LIVRE;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private PostStatus status = PostStatus.DRAFT;

    @Column(name = "country", length = 2)
    private String country;

    @Column(name = "city", length = 120)
    private String city;

    @Column(name = "like_count", insertable = false, updatable = false)
    private long likeCount;

    @Column(name = "comment_count", insertable = false, updatable = false)
    private long commentCount;

    @Column(name = "share_count", insertable = false, updatable = false)
    private long shareCount;

    @Column(name = "view_count", insertable = false, updatable = false)
    private long viewCount;

    /** Data de publicação: relativa no card, absoluta (com fuso) no detalhe. */
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "removed_at")
    private Instant removedAt;

    @Version
    @Column(name = "version", nullable = false)
    private Long version;

    @Transient
    private boolean isNew = true;

    protected Post() {
        // JPA
    }

    public Post(UserControlList author, FeedType feedType, MediaType mediaType, String title) {
        this.id = UuidV7.next();
        this.authorUserId = Objects.requireNonNull(author.getId(), "autor precisa estar persistido");
        this.authorUserType = author.getUserType();
        this.feedType = feedType;
        this.mediaType = mediaType;
        this.title = title;
    }

    @PrePersist
    void onCreate() {
        // micro-segundos: mesma precisão do TIMESTAMPTZ, para o cursor (created_at, id) bater exato
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now().truncatedTo(ChronoUnit.MICROS);
    }

    @PostLoad
    @PostPersist
    void markNotNew() {
        isNew = false;
    }

    // ---------------------------------------------------------------- ciclo de vida

    public void publish() {
        transitionTo(PostStatus.PUBLISHED);
    }

    public void archive() {
        transitionTo(PostStatus.ARCHIVED);
    }

    /** Moderação ou pedido do autor: apaga o conteúdo e mantém só o id e os metadados técnicos. */
    public void remove() {
        transitionTo(PostStatus.REMOVED);
        this.title = REMOVED_TITLE;
        this.subtitle = null;
        this.body = null;
        this.mediaObjectKey = null;
        this.country = null;
        this.city = null;
        this.removedAt = Instant.now().truncatedTo(ChronoUnit.MICROS);
    }

    /** RF24: rascunho só para o autor; removido para ninguém. */
    public boolean isVisibleTo(Long viewerId) {
        return switch (status) {
            case PUBLISHED, ARCHIVED -> true;
            case DRAFT -> authorUserId.equals(viewerId);
            case REMOVED -> false;
        };
    }

    /** RF26: curtir, comentar, compartilhar e salvar só em post publicado. */
    public boolean acceptsInteractions() {
        return status == PostStatus.PUBLISHED;
    }

    public boolean isAuthoredBy(Long userId) {
        return authorUserId.equals(userId);
    }

    private void transitionTo(PostStatus target) {
        if (!status.canTransitionTo(target)) {
            throw new IllegalStateException("Transição inválida: " + status + " -> " + target);
        }
        this.status = target;
    }

    // ---------------------------------------------------------------- getters / setters

    @Override
    public UUID getId() {
        return id;
    }

    @Override
    public boolean isNew() {
        return isNew;
    }

    public Long getAuthorUserId() {
        return authorUserId;
    }

    public UserCategoryEnum getAuthorUserType() {
        return authorUserType;
    }

    public FeedType getFeedType() {
        return feedType;
    }

    public MediaType getMediaType() {
        return mediaType;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getSubtitle() {
        return subtitle;
    }

    public void setSubtitle(String subtitle) {
        this.subtitle = subtitle;
    }

    public String getBody() {
        return body;
    }

    public void setBody(String body) {
        this.body = body;
    }

    public String getMediaObjectKey() {
        return mediaObjectKey;
    }

    public void setMediaObjectKey(String mediaObjectKey) {
        this.mediaObjectKey = mediaObjectKey;
    }

    public Integer getDurationSeconds() {
        return durationSeconds;
    }

    public void setDurationSeconds(Integer durationSeconds) {
        this.durationSeconds = durationSeconds;
    }

    public AgeRating getAgeRating() {
        return ageRating;
    }

    public void setAgeRating(AgeRating ageRating) {
        this.ageRating = ageRating;
    }

    public PostStatus getStatus() {
        return status;
    }

    public String getCountry() {
        return country;
    }

    public void setCountry(String country) {
        this.country = country;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public long getLikeCount() {
        return likeCount;
    }

    public long getCommentCount() {
        return commentCount;
    }

    public long getShareCount() {
        return shareCount;
    }

    public long getViewCount() {
        return viewCount;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Instant getRemovedAt() {
        return removedAt;
    }
}
