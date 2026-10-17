package com.orangesocial.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Clock;
import java.time.Duration;

/**
 * Tempo absoluto de sessão (24 h, NIST AAL2). O ocioso (60 min) é o TTL deslizante do Spring Session; este
 * filtro encerra no servidor a sessão autenticada há mais tempo que o limite, mesmo que continue em uso —
 * inclusive a que o navegador "restaurou" ao reabrir.
 */
public class AbsoluteSessionTimeoutFilter extends OncePerRequestFilter {

    private final Duration maxAge;
    private final Clock clock;

    public AbsoluteSessionTimeoutFilter(Duration maxAge, Clock clock) {
        this.maxAge = maxAge;
        this.clock = clock;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        HttpSession session = request.getSession(false);
        if (session != null && session.getAttribute(SessionService.AUTH_AT) instanceof Long authAt
                && clock.millis() - authAt > maxAge.toMillis()) {
            session.invalidate();
            SecurityContextHolder.clearContext();
        }
        chain.doFilter(request, response);
    }
}
