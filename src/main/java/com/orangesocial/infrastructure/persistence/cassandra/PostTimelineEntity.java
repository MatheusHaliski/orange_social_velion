package com.orangesocial.infrastructure.persistence.cassandra;

import org.springframework.data.cassandra.core.mapping.Column;
import org.springframework.data.cassandra.core.mapping.PrimaryKey;
import org.springframework.data.cassandra.core.mapping.Table;

import java.time.Instant;

/**
 * Linha da timeline desnormalizada (fan-out on write) na tabela
 * {@code orange_social.post_timeline}. Ver src/main/resources/cassandra/schema.cql.
 */
@Table("post_timeline")
public class PostTimelineEntity {

    @PrimaryKey
    private PostTimelineKey key;

    @Column("author_user_id")
    private Long authorUserId;

    /** Cor da categoria do autor no momento da publicação (UserCategoryEnum). */
    @Column("author_user_type")
    private String authorUserType;

    /** TEXT | IMAGE | VIDEO | AUDIO */
    @Column("media_type")
    private String mediaType;

    @Column("title")
    private String title;

    @Column("subtitle")
    private String subtitle;

    /** Chave do objeto no S3. */
    @Column("media_object_key")
    private String mediaObjectKey;

    /** Duração do áudio em segundos (somente Audio Feed). */
    @Column("duration_seconds")
    private Integer durationSeconds;

    @Column("country")
    private String country;

    @Column("city")
    private String city;

    @Column("created_at")
    private Instant createdAt;

    public PostTimelineEntity() {
    }

    public PostTimelineEntity(PostTimelineKey key, Long authorUserId, String authorUserType, String mediaType,
                              String title, Instant createdAt) {
        this.key = key;
        this.authorUserId = authorUserId;
        this.authorUserType = authorUserType;
        this.mediaType = mediaType;
        this.title = title;
        this.createdAt = createdAt;
    }

    public PostTimelineKey getKey() {
        return key;
    }

    public void setKey(PostTimelineKey key) {
        this.key = key;
    }

    public Long getAuthorUserId() {
        return authorUserId;
    }

    public void setAuthorUserId(Long authorUserId) {
        this.authorUserId = authorUserId;
    }

    public String getAuthorUserType() {
        return authorUserType;
    }

    public void setAuthorUserType(String authorUserType) {
        this.authorUserType = authorUserType;
    }

    public String getMediaType() {
        return mediaType;
    }

    public void setMediaType(String mediaType) {
        this.mediaType = mediaType;
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

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
