package com.orangesocial.application.account;

import com.orangesocial.application.account.AccountViews.PreferencesView;
import com.orangesocial.domain.model.FeedType;
import com.orangesocial.domain.model.UserControlList;
import com.orangesocial.domain.model.UserPreference;
import com.orangesocial.infrastructure.persistence.postgres.UserControlListRepository;
import com.orangesocial.infrastructure.persistence.postgres.UserPreferenceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * Configurações → Exibição, Privacidade, Conteúdo, Bem-estar e Notificações. Campos {@code null} no PATCH ficam
 * como estão. Para menor de 16 (ECA Digital), afrouxar uma proteção (perfil público, conteúdo sensível) é
 * bloqueado até existir o vínculo com o responsável (OS-49).
 */
@Service
public class PreferencesService {

    static final Set<String> LANGUAGES = Set.of("pt-BR", "en", "es");
    static final Set<String> NOTIFICATION_KEYS = Set.of("likes", "comments", "shares", "officialAlerts");

    private final UserPreferenceRepository preferences;
    private final UserControlListRepository users;
    private final AgePolicy age;

    public PreferencesService(UserPreferenceRepository preferences, UserControlListRepository users, AgePolicy age) {
        this.preferences = preferences;
        this.users = users;
        this.age = age;
    }

    public record PreferencesPatch(UserPreference.Theme theme, UserPreference.AppBackground appBackground,
                                   String language, Integer fontScale, Boolean reduceMotion, Boolean profilePrivate,
                                   UserPreference.CommentAudience whoCanComment, Boolean showBirthYear,
                                   FeedType defaultFeed, UserPreference.SensitiveContent sensitiveContent,
                                   Integer usageReminderMinutes, Boolean clearUsageReminder,
                                   Map<String, Boolean> notifications, Boolean loginAlerts) {
    }

    @Transactional
    public PreferencesView get(long userId) {
        UserControlList user = users.findById(userId).orElseThrow();
        boolean minor = age.protectedMinor(user.getUserDateOfBirth());
        return PreferencesView.of(load(userId, minor), minor);
    }

    @Transactional
    public PreferencesView update(long userId, PreferencesPatch p) {
        UserControlList user = users.findById(userId).orElseThrow();
        boolean minor = age.protectedMinor(user.getUserDateOfBirth());
        UserPreference pref = load(userId, minor);
        if (minor && (Boolean.FALSE.equals(p.profilePrivate())
                || p.sensitiveContent() == UserPreference.SensitiveContent.ALLOW
                || p.whoCanComment() == UserPreference.CommentAudience.EVERYONE)) {
            throw new AccountExceptions.Forbidden(
                    "Para menores de 16 anos essa proteção fica ligada; só o responsável pode alterá-la (ECA Digital).");
        }
        if (p.theme() != null) pref.setTheme(p.theme());
        if (p.appBackground() != null) pref.setAppBackground(p.appBackground());
        if (p.language() != null) {
            if (!LANGUAGES.contains(p.language())) {
                throw new AccountExceptions.Invalid("Idioma disponível: pt-BR, en ou es.");
            }
            pref.setLanguage(p.language());
        }
        if (p.fontScale() != null) {
            if (p.fontScale() < 85 || p.fontScale() > 150) {
                throw new AccountExceptions.Invalid("O tamanho da fonte vai de 85% a 150%.");
            }
            pref.setFontScale(p.fontScale().shortValue());
        }
        if (p.reduceMotion() != null) pref.setReduceMotion(p.reduceMotion());
        if (p.profilePrivate() != null) pref.setProfilePrivate(p.profilePrivate());
        if (p.whoCanComment() != null) pref.setWhoCanComment(p.whoCanComment());
        if (p.showBirthYear() != null) pref.setShowBirthYear(p.showBirthYear());
        if (p.defaultFeed() != null) pref.setDefaultFeed(p.defaultFeed());
        if (p.sensitiveContent() != null) pref.setSensitiveContent(p.sensitiveContent());
        if (Boolean.TRUE.equals(p.clearUsageReminder())) {
            if (minor) {
                throw new AccountExceptions.Forbidden("Para menores de 16 anos o lembrete de tempo de uso fica ligado.");
            }
            pref.setUsageReminderMinutes(null);
        } else if (p.usageReminderMinutes() != null) {
            if (p.usageReminderMinutes() < 10 || p.usageReminderMinutes() > 600) {
                throw new AccountExceptions.Invalid("O lembrete de tempo de uso vai de 10 a 600 minutos.");
            }
            pref.setUsageReminderMinutes(p.usageReminderMinutes().shortValue());
        }
        if (p.notifications() != null) {
            if (!NOTIFICATION_KEYS.containsAll(p.notifications().keySet())) {
                throw new AccountExceptions.Invalid("Notificações disponíveis: " + String.join(", ", NOTIFICATION_KEYS) + ".");
            }
            Map<String, Boolean> merged = new LinkedHashMap<>(pref.getNotifications());
            merged.putAll(p.notifications());
            pref.setNotifications(merged);
        }
        if (p.loginAlerts() != null) pref.setLoginAlerts(p.loginAlerts());
        return PreferencesView.of(preferences.save(pref), minor);
    }

    private UserPreference load(long userId, boolean minor) {
        return preferences.findById(userId).orElseGet(() -> preferences.save(UserPreference.defaultsFor(userId, minor)));
    }
}
