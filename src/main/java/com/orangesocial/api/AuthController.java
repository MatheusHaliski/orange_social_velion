package com.orangesocial.api;

import com.orangesocial.application.account.AccountViews.LoginResult;
import com.orangesocial.application.account.AccountViews.SessionUserView;
import com.orangesocial.application.account.AuthService;
import com.orangesocial.application.account.RegistrationService;
import com.orangesocial.application.account.RegistrationService.Registration;
import com.orangesocial.application.post.PostExceptions;
import com.orangesocial.domain.model.UserCategoryEnum;
import com.orangesocial.domain.model.UserControlList;
import com.orangesocial.security.AppSecrets;
import com.orangesocial.security.ClientInfo;
import com.orangesocial.security.SessionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.Map;

/**
 * Cadastro, login em etapas, reativação e logout (RF1 · RF27). Tudo aqui é público; o resto da API exige a
 * sessão criada por estes endpoints. Escritas exigem o cabeçalho {@code X-XSRF-TOKEN} (pegue em {@code GET /csrf}).
 */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final RegistrationService registration;
    private final AuthService auth;
    private final SessionService sessions;
    private final ViewerResolver viewer;
    private final AppSecrets secrets;

    public AuthController(RegistrationService registration, AuthService auth, SessionService sessions,
                          ViewerResolver viewer, AppSecrets secrets) {
        this.registration = registration;
        this.auth = auth;
        this.sessions = sessions;
        this.viewer = viewer;
        this.secrets = secrets;
    }

    /** Gera o cookie {@code XSRF-TOKEN}; chame ao abrir o app e depois de login/logout. */
    @GetMapping("/csrf")
    public Map<String, String> csrf(CsrfToken token) {
        return Map.of("headerName", token.getHeaderName(), "token", token.getToken());
    }

    /** Quem está logado neste navegador; 401 se não houver sessão (aba anônima, logout, sessão expirada). */
    @GetMapping("/session")
    public SessionUserView session() {
        return auth.me(viewer.viewerId().orElseThrow(PostExceptions.Unauthenticated::new));
    }

    public record RegisterRequest(String name, String handle, String email, String password, UserCategoryEnum userType,
                                  LocalDate dateOfBirth, boolean acceptTerms, String termsVersion,
                                  Map<String, Object> typeDetails) {
    }

    /** Cria a conta (PENDING_VERIFICATION), envia o código por e-mail e já entra — o app pede o código em seguida. */
    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public LoginResult register(@RequestBody RegisterRequest r, HttpServletRequest request, HttpServletResponse response) {
        ClientInfo client = ClientInfo.from(request, secrets);
        UserControlList user = registration.register(new Registration(r.name(), r.handle(), r.email(), r.password(),
                r.userType(), r.dateOfBirth(), r.acceptTerms(), r.termsVersion(), r.typeDetails()), client);
        sessions.establish(user.getId(), client, request, response);
        return new LoginResult(com.orangesocial.application.account.AccountViews.LoginStatus.AUTHENTICATED,
                auth.me(user.getId()), null, "Enviamos um código de 6 dígitos para " + user.getEmail() + ".");
    }

    public record LoginRequest(String email, String password) {
    }

    @PostMapping("/login")
    public LoginResult login(@RequestBody LoginRequest body, HttpServletRequest request, HttpServletResponse response) {
        return auth.login(body.email(), body.password(), ClientInfo.from(request, secrets), request, response);
    }

    public record CodeRequest(String code) {
    }

    /** Segunda etapa: código do app autenticador ou código de recuperação. */
    @PostMapping("/login/2fa")
    public LoginResult loginSecondFactor(@RequestBody CodeRequest body, HttpServletRequest request,
                                         HttpServletResponse response) {
        return auth.completeMfa(body.code(), ClientInfo.from(request, secrets), request, response);
    }

    /** Conta em exclusão, dentro dos 30 dias: desfaz o pedido e entra. */
    @PostMapping("/reactivate")
    public LoginResult reactivate(HttpServletRequest request, HttpServletResponse response) {
        return auth.reactivate(ClientInfo.from(request, secrets), request, response);
    }

    /** Encerra a sessão no servidor; as outras abas recebem 401 na próxima chamada (e o app avisa via BroadcastChannel). */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        auth.logout(request);
        return ResponseEntity.noContent().build();
    }
}
