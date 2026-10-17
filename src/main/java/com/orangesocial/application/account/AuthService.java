package com.orangesocial.application.account;

import com.orangesocial.application.account.AccountViews.CategoryView;
import com.orangesocial.application.account.AccountViews.LoginResult;
import com.orangesocial.application.account.AccountViews.LoginStatus;
import com.orangesocial.application.account.AccountViews.SessionUserView;
import com.orangesocial.domain.model.AccountStatus;
import com.orangesocial.domain.model.TermsAcceptance;
import com.orangesocial.domain.model.UserControlList;
import com.orangesocial.infrastructure.persistence.postgres.TermsAcceptanceRepository;
import com.orangesocial.infrastructure.persistence.postgres.UserControlListRepository;
import com.orangesocial.infrastructure.persistence.postgres.UserPreferenceRepository;
import com.orangesocial.security.ClientInfo;
import com.orangesocial.security.LoginThrottle;
import com.orangesocial.security.PendingLogin;
import com.orangesocial.security.SessionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.util.UUID;

/**
 * Login em etapas (RF27): senha → [código do 2FA] → [reativar conta em exclusão] → sessão.
 * A sessão completa só nasce no fim, com id novo. Mensagens neutras, mesmo custo de hash para e-mail
 * inexistente e limite de tentativas por conta e por IP.
 */
@Service
public class AuthService {

    static final Duration PENDING_TTL = Duration.ofMinutes(5);

    private final UserControlListRepository users;
    private final UserPreferenceRepository preferences;
    private final TermsAcceptanceRepository terms;
    private final PasswordEncoder passwords;
    private final LoginThrottle throttle;
    private final SessionService sessions;
    private final MfaService mfa;
    private final AccountNotifier notifier;
    private final LegalDocuments legal;
    private final AgePolicy age;
    private final Clock clock;
    private final String dummyHash;

    public AuthService(UserControlListRepository users, UserPreferenceRepository preferences,
                       TermsAcceptanceRepository terms, PasswordEncoder passwords, LoginThrottle throttle,
                       SessionService sessions, MfaService mfa, AccountNotifier notifier, LegalDocuments legal,
                       AgePolicy age, Clock clock) {
        this.users = users;
        this.preferences = preferences;
        this.terms = terms;
        this.passwords = passwords;
        this.throttle = throttle;
        this.sessions = sessions;
        this.mfa = mfa;
        this.notifier = notifier;
        this.legal = legal;
        this.age = age;
        this.clock = clock;
        this.dummyHash = passwords.encode(UUID.randomUUID().toString());
    }

    @Transactional
    public LoginResult login(String email, String password, ClientInfo client,
                             HttpServletRequest request, HttpServletResponse response) {
        String account = UserControlList.normalizeEmail(email == null ? "" : email);
        throttle.beforeAttempt(account, client.ipHash());
        UserControlList user = users.findByEmail(account).orElse(null);
        boolean ok = passwords.matches(password == null ? "" : password, user == null ? dummyHash : user.getPasswordHash())
                && user != null && user.getAccountStatus() != AccountStatus.ANONYMOUS_LGPD_DELETED;
        if (ok && user.getAccountStatus() == AccountStatus.PENDING_DELETION && !user.canReactivate(clock.instant())) {
            ok = false;   // prazo de reativação vencido: a eliminação já está na fila
        }
        if (!ok) {
            throttle.onFailure(account);
            throw new AccountExceptions.BadCredentials();
        }
        throttle.onSuccess(account);
        if (user.getAccountStatus() == AccountStatus.SUSPENDED) {
            throw new AccountExceptions.Forbidden("Esta conta está suspensa. Veja o e-mail que enviamos ou fale com o suporte.");
        }
        if (passwords.upgradeEncoding(user.getPasswordHash())) {
            user.setPasswordHash(passwords.encode(password));
        }
        if (mfa.isEnabled(user.getId())) {
            pending(request, user, PendingLogin.Step.MFA);
            return new LoginResult(LoginStatus.MFA_REQUIRED, null, null,
                    "Digite o código do app autenticador ou um código de recuperação.");
        }
        return afterSecondFactor(user, client, request, response);
    }

    @Transactional
    public LoginResult completeMfa(String code, ClientInfo client, HttpServletRequest request, HttpServletResponse response) {
        HttpSession session = request.getSession(false);
        PendingLogin pending = PendingLogin.get(session);
        if (pending == null || pending.step() != PendingLogin.Step.MFA || pending.expired(clock.instant())) {
            if (session != null) {
                PendingLogin.clear(session);
            }
            throw new AccountExceptions.BadCredentials("A etapa de verificação expirou. Entre com e-mail e senha de novo.");
        }
        if (!mfa.verify(pending.userId(), code)) {
            PendingLogin next = pending.withFailure();
            if (next.attempts() >= PendingLogin.MAX_ATTEMPTS) {
                PendingLogin.clear(session);
                throw new AccountExceptions.BadCredentials("Código incorreto muitas vezes. Entre com e-mail e senha de novo.");
            }
            session.setAttribute(PendingLogin.ATTRIBUTE, next);
            throw new AccountExceptions.BadCredentials("Código incorreto.");
        }
        return afterSecondFactor(users.findById(pending.userId()).orElseThrow(), client, request, response);
    }

    @Transactional
    public LoginResult reactivate(ClientInfo client, HttpServletRequest request, HttpServletResponse response) {
        PendingLogin pending = PendingLogin.get(request.getSession(false));
        if (pending == null || pending.step() != PendingLogin.Step.REACTIVATION || pending.expired(clock.instant())) {
            throw new AccountExceptions.BadCredentials("Entre com e-mail e senha para reativar a conta.");
        }
        UserControlList user = users.findById(pending.userId()).orElseThrow();
        if (!user.canReactivate(clock.instant())) {
            throw new AccountExceptions.Forbidden("O prazo de 30 dias para reativar esta conta terminou.");
        }
        user.reactivate(clock.instant());
        notifier.accountReactivated(user);
        return establish(user, client, request, response);
    }

    public void logout(HttpServletRequest request) {
        sessions.logout(request);
    }

    @Transactional(readOnly = true)
    public SessionUserView me(long userId) {
        return view(users.findById(userId).orElseThrow());
    }

    /** Termos novos publicados: o app pede o aceite antes de seguir. */
    @Transactional
    public SessionUserView acceptCurrentTerms(long userId, String version, ClientInfo client) {
        if (!legal.termsVersion().equals(version)) {
            throw new AccountExceptions.Invalid("Aceite a versão vigente dos Termos de Uso (" + legal.termsVersion() + ").");
        }
        terms.save(new TermsAcceptance(userId, TermsAcceptance.TERMS_OF_USE, version, client.channel(), client.ipHash()));
        return me(userId);
    }

    private LoginResult afterSecondFactor(UserControlList user, ClientInfo client,
                                          HttpServletRequest request, HttpServletResponse response) {
        if (user.getAccountStatus() == AccountStatus.PENDING_DELETION) {
            pending(request, user, PendingLogin.Step.REACTIVATION);
            return new LoginResult(LoginStatus.REACTIVATION_AVAILABLE, null, user.getDeletionScheduledFor(),
                    "Sua conta está marcada para exclusão. Quer reativá-la?");
        }
        return establish(user, client, request, response);
    }

    private LoginResult establish(UserControlList user, ClientInfo client,
                                  HttpServletRequest request, HttpServletResponse response) {
        sessions.establish(user.getId(), client, request, response);
        preferences.findById(user.getId()).filter(p -> p.isLoginAlerts())
                .ifPresent(p -> notifier.loginAlert(user, client.device()));
        return LoginResult.authenticated(view(user));
    }

    private void pending(HttpServletRequest request, UserControlList user, PendingLogin.Step step) {
        request.getSession(true).setAttribute(PendingLogin.ATTRIBUTE,
                new PendingLogin(user.getId(), step, clock.instant().plus(PENDING_TTL), 0));
    }

    SessionUserView view(UserControlList u) {
        boolean termsUpToDate = terms.findFirstByUserIdAndDocumentOrderByAcceptedAtDesc(u.getId(), TermsAcceptance.TERMS_OF_USE)
                .map(t -> legal.termsVersion().equals(t.getVersion())).orElse(false);
        return new SessionUserView(u.getId(), u.getName(), u.getHandle(), u.getEmail(), CategoryView.of(u.getUserType()),
                u.getCategoryVerification(), u.getAccountStatus(), u.getEmailVerifiedAt() != null,
                mfa.isEnabled(u.getId()), age.protectedMinor(u.getUserDateOfBirth()), termsUpToDate);
    }
}
