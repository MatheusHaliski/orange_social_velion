package com.orangesocial.application.account;

import com.orangesocial.domain.model.AccountStatus;
import com.orangesocial.domain.model.CategoryVerification;
import com.orangesocial.domain.model.FeedType;
import com.orangesocial.domain.model.UserCategoryEnum;
import com.orangesocial.domain.model.UserPreference;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** Respostas da API de conta: sessão, cadastro, 2FA, exclusão, perfil e preferências. */
public final class AccountViews {

    private AccountViews() {
    }

    public record CategoryView(String code, String label, String color) {
        public static CategoryView of(UserCategoryEnum c) {
            return new CategoryView(c.name(), c.getLabel(), c.getHexColor());
        }
    }

    /** Quem está logado — o que o app precisa para montar a casca (sem dado sensível). */
    public record SessionUserView(long id, String name, String handle, String email, CategoryView category,
                                  CategoryVerification categoryVerification, AccountStatus accountStatus,
                                  boolean emailVerified, boolean mfaEnabled, boolean minor, boolean termsUpToDate) {
    }

    public enum LoginStatus {
        /** Sessão criada. */
        AUTHENTICATED,
        /** Senha certa; falta o código do app autenticador ({@code POST /api/v1/auth/login/2fa}). */
        MFA_REQUIRED,
        /** Conta em exclusão dentro do prazo; pode reativar ({@code POST /api/v1/auth/reactivate}). */
        REACTIVATION_AVAILABLE
    }

    public record LoginResult(LoginStatus status, SessionUserView user, Instant deletionScheduledFor, String message) {
        static LoginResult authenticated(SessionUserView user) {
            return new LoginResult(LoginStatus.AUTHENTICATED, user, null, null);
        }
    }

    public record TermsView(String version, String url) {
    }

    public record MfaStatusView(boolean enabled, Instant enabledAt, long recoveryCodesLeft) {
    }

    /** Chave para o app autenticador: QR code a partir da URI ou digitação da chave. Some ao confirmar. */
    public record MfaSetupView(String secret, String otpauthUri, String issuer, String account, Instant expiresAt) {
    }

    /** Mostrados uma única vez. */
    public record RecoveryCodesView(List<String> codes, Instant generatedAt) {
    }

    public record DeletionView(AccountStatus accountStatus, Instant deletionScheduledFor, int graceDays) {
    }

    /** Perfil completo para o próprio titular (Configurações → Conta), inclusive campos privados. */
    public record ProfileView(long id, String name, String handle, String email, String recoveryEmail,
                              String cellphoneNumber, LocalDate dateOfBirth, String gender, String bio,
                              List<String> pronouns, List<String> links, String countryOfResidence,
                              String stateOfResidence, String cityOfResidence, CategoryView category,
                              CategoryVerification categoryVerification, Map<String, Object> typeDetails,
                              String avatarObjectKey) {
    }

    public record PreferencesView(UserPreference.Theme theme, UserPreference.AppBackground appBackground,
                                  String language, int fontScale, boolean reduceMotion, boolean profilePrivate,
                                  UserPreference.CommentAudience whoCanComment, boolean showBirthYear,
                                  FeedType defaultFeed, UserPreference.SensitiveContent sensitiveContent,
                                  Integer usageReminderMinutes, Map<String, Boolean> notifications,
                                  boolean loginAlerts, boolean minorProtectionsLocked) {
        static PreferencesView of(UserPreference p, boolean minor) {
            return new PreferencesView(p.getTheme(), p.getAppBackground(), p.getLanguage(), p.getFontScale(),
                    p.isReduceMotion(), p.isProfilePrivate(), p.getWhoCanComment(), p.isShowBirthYear(),
                    p.getDefaultFeed(), p.getSensitiveContent(),
                    p.getUsageReminderMinutes() == null ? null : p.getUsageReminderMinutes().intValue(),
                    p.getNotifications(), p.isLoginAlerts(), minor);
        }
    }
}
