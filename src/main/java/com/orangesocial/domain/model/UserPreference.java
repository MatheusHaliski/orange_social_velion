package com.orangesocial.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/** Configurações e preferências do usuário (tabela {@code user_preference}; docs/PESQUISA_DADOS_USUARIO.md §4). */
@Entity
@Table(name = "user_preference")
public class UserPreference {

    public enum Theme { SYSTEM, DARK, LIGHT }

    /**
     * Fundo do app (Configurações → Exibição). Artes em design/brand/: o logo em rede, o mosaico laranja
     * (também o fundo do login e do cadastro) e as cinco artes de mosaico com o logo oficial no lugar do
     * genérico (backgrounds/, edit_backgrounds.py).
     * O app aplica um véu escuro/claro por cima para manter o contraste dos cards (WCAG 1.4.3).
     */
    public enum AppBackground {
        PLAIN, NETWORK, MOSAIC, MOSAIC_CLASSIC, MOSAIC_DEEP, MOSAIC_GLOW, MOSAIC_SKY, MOSAIC_SAND
    }

    public enum CommentAudience { EVERYONE, FOLLOWERS, NOBODY }

    public enum SensitiveContent { LIMIT, ALLOW }

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "theme", nullable = false)
    private Theme theme = Theme.SYSTEM;

    @Enumerated(EnumType.STRING)
    @Column(name = "app_background", nullable = false)
    private AppBackground appBackground = AppBackground.PLAIN;

    @Column(name = "language", nullable = false)
    private String language = "pt-BR";

    @Column(name = "font_scale", nullable = false)
    private short fontScale = 100;

    @Column(name = "reduce_motion", nullable = false)
    private boolean reduceMotion;

    @Column(name = "profile_private", nullable = false)
    private boolean profilePrivate;

    @Enumerated(EnumType.STRING)
    @Column(name = "who_can_comment", nullable = false)
    private CommentAudience whoCanComment = CommentAudience.EVERYONE;

    @Column(name = "show_birth_year", nullable = false)
    private boolean showBirthYear;

    @Enumerated(EnumType.STRING)
    @Column(name = "default_feed", nullable = false)
    private FeedType defaultFeed = FeedType.POST;

    @Enumerated(EnumType.STRING)
    @Column(name = "sensitive_content", nullable = false)
    private SensitiveContent sensitiveContent = SensitiveContent.LIMIT;

    @Column(name = "usage_reminder_minutes")
    private Short usageReminderMinutes;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "notifications", nullable = false)
    private Map<String, Boolean> notifications = defaultNotifications();

    @Column(name = "login_alerts", nullable = false)
    private boolean loginAlerts = true;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected UserPreference() {
        // JPA
    }

    /** Padrões do cadastro. Menor de 16 (ECA Digital): perfil privado, comentários só de seguidores. */
    public static UserPreference defaultsFor(Long userId, boolean minor) {
        UserPreference p = new UserPreference();
        p.userId = userId;
        if (minor) {
            p.profilePrivate = true;
            p.whoCanComment = CommentAudience.FOLLOWERS;
            p.usageReminderMinutes = 60;
        }
        return p;
    }

    public static Map<String, Boolean> defaultNotifications() {
        Map<String, Boolean> n = new LinkedHashMap<>();
        n.put("likes", true);
        n.put("comments", true);
        n.put("shares", true);
        n.put("officialAlerts", true);
        return n;
    }

    @PrePersist
    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }

    public Long getUserId() { return userId; }
    public Theme getTheme() { return theme; }
    public void setTheme(Theme theme) { this.theme = theme; }
    public AppBackground getAppBackground() { return appBackground; }
    public void setAppBackground(AppBackground appBackground) { this.appBackground = appBackground; }
    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }
    public short getFontScale() { return fontScale; }
    public void setFontScale(short fontScale) { this.fontScale = fontScale; }
    public boolean isReduceMotion() { return reduceMotion; }
    public void setReduceMotion(boolean reduceMotion) { this.reduceMotion = reduceMotion; }
    public boolean isProfilePrivate() { return profilePrivate; }
    public void setProfilePrivate(boolean profilePrivate) { this.profilePrivate = profilePrivate; }
    public CommentAudience getWhoCanComment() { return whoCanComment; }
    public void setWhoCanComment(CommentAudience whoCanComment) { this.whoCanComment = whoCanComment; }
    public boolean isShowBirthYear() { return showBirthYear; }
    public void setShowBirthYear(boolean showBirthYear) { this.showBirthYear = showBirthYear; }
    public FeedType getDefaultFeed() { return defaultFeed; }
    public void setDefaultFeed(FeedType defaultFeed) { this.defaultFeed = defaultFeed; }
    public SensitiveContent getSensitiveContent() { return sensitiveContent; }
    public void setSensitiveContent(SensitiveContent sensitiveContent) { this.sensitiveContent = sensitiveContent; }
    public Short getUsageReminderMinutes() { return usageReminderMinutes; }
    public void setUsageReminderMinutes(Short usageReminderMinutes) { this.usageReminderMinutes = usageReminderMinutes; }
    public Map<String, Boolean> getNotifications() { return notifications; }
    public void setNotifications(Map<String, Boolean> notifications) { this.notifications = notifications; }
    public boolean isLoginAlerts() { return loginAlerts; }
    public void setLoginAlerts(boolean loginAlerts) { this.loginAlerts = loginAlerts; }
    public Instant getUpdatedAt() { return updatedAt; }
}
