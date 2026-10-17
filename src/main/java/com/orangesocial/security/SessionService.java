package com.orangesocial.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * Sessões opacas no Valkey (Spring Session indexado pelo id do usuário):
 * cria a sessão completa depois do login (id novo — anti-fixação), lista, encerra uma, as outras ou todas.
 *
 * <p>O id de sessão é o próprio segredo do cookie, então a API nunca o devolve: a lista usa um identificador
 * derivado (HMAC), que só serve para pedir o encerramento.
 */
@Service
public class SessionService {

    public static final String AUTH_AT = "orange.authAt";
    public static final String DEVICE = "orange.device";
    public static final String CHANNEL = "orange.channel";

    private final FindByIndexNameSessionRepository<? extends Session> sessions;
    private final SecurityContextRepository contextRepository;
    private final AppSecrets secrets;
    private final Clock clock;

    public SessionService(FindByIndexNameSessionRepository<? extends Session> sessions,
                          SecurityContextRepository contextRepository, AppSecrets secrets, Clock clock) {
        this.sessions = sessions;
        this.contextRepository = contextRepository;
        this.secrets = secrets;
        this.clock = clock;
    }

    /** Login concluído (senha e, se houver, 2FA): troca o id da sessão e grava o usuário nela. */
    public void establish(long userId, ClientInfo client, HttpServletRequest request, HttpServletResponse response) {
        HttpSession session = request.getSession(true);
        request.changeSessionId();
        PendingLogin.clear(session);
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(
                new OrangePrincipal(userId), null, List.of(new SimpleGrantedAuthority("ROLE_USER"))));
        SecurityContextHolder.setContext(context);
        contextRepository.saveContext(context, request, response);
        session.setAttribute(AUTH_AT, clock.millis());
        session.setAttribute(DEVICE, client.device());
        session.setAttribute(CHANNEL, client.channel());
    }

    /** Logout desta sessão: invalida no servidor (o cookie velho deixa de valer em qualquer aba). */
    public void logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
    }

    public List<SessionView> list(long userId, String currentSessionId) {
        Map<String, ? extends Session> found = sessions.findByPrincipalName(Long.toString(userId));
        return found.values().stream()
                .map(s -> new SessionView(handle(s.getId()), s.getAttribute(DEVICE), s.getAttribute(CHANNEL),
                        s.getCreationTime(), s.getLastAccessedTime(), s.getId().equals(currentSessionId)))
                .sorted(Comparator.comparing(SessionView::current).reversed()
                        .thenComparing(SessionView::lastAccessAt, Comparator.reverseOrder()))
                .toList();
    }

    /** Encerra a sessão com este identificador, se for do usuário. */
    public boolean revoke(long userId, String handle) {
        return sessions.findByPrincipalName(Long.toString(userId)).keySet().stream()
                .filter(id -> handle(id).equals(handle))
                .findFirst()
                .map(id -> {
                    sessions.deleteById(id);
                    return true;
                })
                .orElse(false);
    }

    /** "Sair de todos os outros aparelhos" (keep = sessão atual) ou de todos (keep = null). */
    public int revokeAll(long userId, String keepSessionId) {
        int n = 0;
        for (String id : sessions.findByPrincipalName(Long.toString(userId)).keySet()) {
            if (!id.equals(keepSessionId)) {
                sessions.deleteById(id);
                n++;
            }
        }
        return n;
    }

    public String handle(String sessionId) {
        return secrets.fingerprint("session-handle", sessionId).substring(0, 24);
    }

    /** Sessão ativa, sem o id real. */
    public record SessionView(String id, String device, String channel, Instant createdAt, Instant lastAccessAt,
                              boolean current) {
    }
}
