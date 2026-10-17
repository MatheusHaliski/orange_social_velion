package com.orangesocial.api;

import com.orangesocial.application.account.AccountService;
import com.orangesocial.application.account.AccountViews.DeletionView;
import com.orangesocial.application.account.AccountViews.MfaSetupView;
import com.orangesocial.application.account.AccountViews.MfaStatusView;
import com.orangesocial.application.account.AccountViews.PreferencesView;
import com.orangesocial.application.account.AccountViews.ProfileView;
import com.orangesocial.application.account.AccountViews.RecoveryCodesView;
import com.orangesocial.application.account.AccountViews.SessionUserView;
import com.orangesocial.application.account.AuthService;
import com.orangesocial.application.account.EmailVerificationService;
import com.orangesocial.application.account.MfaService;
import com.orangesocial.application.account.PreferencesService;
import com.orangesocial.application.account.PreferencesService.PreferencesPatch;
import com.orangesocial.application.account.ProfileService;
import com.orangesocial.application.account.ProfileService.ProfilePatch;
import com.orangesocial.application.account.StepUp;
import com.orangesocial.domain.model.UserControlList;
import com.orangesocial.security.AppSecrets;
import com.orangesocial.security.ClientInfo;
import com.orangesocial.security.SessionService;
import com.orangesocial.security.SessionService.SessionView;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * A própria conta (exige sessão): perfil (RF2), Configurações (preferências, 2FA, sessões, senha), verificação
 * de e-mail (RF1), Termos de Uso e "Excluir conta" com 30 dias para reativar (RF23).
 */
@RestController
@RequestMapping("/api/v1/me")
public class MeController {

    private final ViewerResolver viewer;
    private final AuthService auth;
    private final ProfileService profiles;
    private final PreferencesService preferences;
    private final EmailVerificationService verification;
    private final MfaService mfa;
    private final StepUp stepUp;
    private final SessionService sessions;
    private final AccountService accounts;
    private final AppSecrets secrets;

    public MeController(ViewerResolver viewer, AuthService auth, ProfileService profiles, PreferencesService preferences,
                        EmailVerificationService verification, MfaService mfa, StepUp stepUp, SessionService sessions,
                        AccountService accounts, AppSecrets secrets) {
        this.viewer = viewer;
        this.auth = auth;
        this.profiles = profiles;
        this.preferences = preferences;
        this.verification = verification;
        this.mfa = mfa;
        this.stepUp = stepUp;
        this.sessions = sessions;
        this.accounts = accounts;
        this.secrets = secrets;
    }

    @GetMapping
    public SessionUserView me() {
        return auth.me(viewer.requireViewer());
    }

    // ------------------------------------------------------------ perfil (RF2) e preferências

    @GetMapping("/profile")
    public ProfileView profile() {
        return profiles.get(viewer.requireViewer());
    }

    @PatchMapping("/profile")
    public ProfileView updateProfile(@RequestBody ProfilePatch patch) {
        return profiles.update(viewer.requireViewer(), patch);
    }

    @GetMapping("/preferences")
    public PreferencesView preferences() {
        return preferences.get(viewer.requireViewer());
    }

    @PatchMapping("/preferences")
    public PreferencesView updatePreferences(@RequestBody PreferencesPatch patch) {
        return preferences.update(viewer.requireViewer(), patch);
    }

    public record TermsRequest(String version) {
    }

    @PostMapping("/terms")
    public SessionUserView acceptTerms(@RequestBody TermsRequest body, HttpServletRequest request) {
        return auth.acceptCurrentTerms(viewer.requireViewer(), body.version(), ClientInfo.from(request, secrets));
    }

    // ------------------------------------------------------------ verificação de e-mail (RF1)

    public record CodeRequest(String code) {
    }

    @PostMapping("/verify-email")
    public SessionUserView verifyEmail(@RequestBody CodeRequest body) {
        long id = viewer.requireViewer();
        verification.confirm(id, body.code());
        return auth.me(id);
    }

    @PostMapping("/verify-email/resend")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void resendVerification() {
        verification.resend(viewer.requireViewer());
    }

    // ------------------------------------------------------------ senha e sessões

    /** Modo sudo: senha atual (+ código, com 2FA). */
    public record SudoRequest(String password, String code) {
    }

    public record PasswordChange(String currentPassword, String code, String newPassword) {
    }

    @PostMapping("/password")
    public Map<String, Integer> changePassword(@RequestBody PasswordChange body, HttpServletRequest request) {
        UserControlList user = stepUp.confirm(viewer.requireViewer(), body.currentPassword(), body.code(), ip(request));
        int closed = accounts.changePassword(user, body.newPassword(), request.getSession().getId());
        return Map.of("otherSessionsClosed", closed);
    }

    @GetMapping("/sessions")
    public List<SessionView> sessions(HttpServletRequest request) {
        return sessions.list(viewer.requireViewer(), request.getSession().getId());
    }

    @DeleteMapping("/sessions/{id}")
    public ResponseEntity<Void> endSession(@PathVariable String id) {
        return sessions.revoke(viewer.requireViewer(), id)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }

    /** "Sair de todos os outros aparelhos". */
    @DeleteMapping("/sessions")
    public Map<String, Integer> endOtherSessions(HttpServletRequest request) {
        return Map.of("closed", sessions.revokeAll(viewer.requireViewer(), request.getSession().getId()));
    }

    // ------------------------------------------------------------ 2FA

    @GetMapping("/mfa")
    public MfaStatusView mfaStatus() {
        return mfa.status(viewer.requireViewer());
    }

    /** Começa a ativação: pede a senha (adicionar fator é ação sensível) e devolve a chave e a URI do QR code. */
    @PostMapping("/mfa/totp")
    public MfaSetupView startTotp(@RequestBody SudoRequest body, HttpServletRequest request) {
        long id = viewer.requireViewer();
        stepUp.confirm(id, body.password(), body.code(), ip(request));
        return mfa.startSetup(id, request.getSession());
    }

    @PostMapping("/mfa/totp/confirm")
    public RecoveryCodesView confirmTotp(@RequestBody CodeRequest body, HttpServletRequest request) {
        return mfa.confirmSetup(viewer.requireViewer(), body.code(), request.getSession());
    }

    @PostMapping("/mfa/recovery-codes")
    public RecoveryCodesView newRecoveryCodes(@RequestBody SudoRequest body, HttpServletRequest request) {
        long id = viewer.requireViewer();
        stepUp.confirm(id, body.password(), body.code(), ip(request));
        return mfa.regenerateRecoveryCodes(id);
    }

    @PostMapping("/mfa/disable")
    public MfaStatusView disableMfa(@RequestBody SudoRequest body, HttpServletRequest request) {
        long id = viewer.requireViewer();
        stepUp.confirm(id, body.password(), body.code(), ip(request));
        mfa.disable(id);
        return mfa.status(id);
    }

    // ------------------------------------------------------------ excluir conta (RF23)

    public record DeletionRequest(String password, String code, boolean confirm) {
    }

    /**
     * Confirmação do modal "Excluir sua conta?": senha (+2FA) e a caixa "entendo as consequências".
     * Encerra todas as sessões, inclusive esta; entrar de novo em até 30 dias permite reativar.
     */
    @PostMapping("/deletion")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public DeletionView requestDeletion(@RequestBody DeletionRequest body, HttpServletRequest request) {
        if (!body.confirm()) {
            throw new com.orangesocial.application.account.AccountExceptions.Invalid(
                    "Confirme que entendeu as consequências da exclusão.");
        }
        UserControlList user = stepUp.confirm(viewer.requireViewer(), body.password(), body.code(), ip(request));
        DeletionView result = accounts.requestDeletion(user);
        sessions.logout(request);
        return result;
    }

    private String ip(HttpServletRequest request) {
        return ClientInfo.from(request, secrets).ipHash();
    }
}
