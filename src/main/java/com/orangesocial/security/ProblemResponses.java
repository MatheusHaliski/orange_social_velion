package com.orangesocial.security;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.csrf.CsrfException;

import java.io.IOException;

/** 401 e 403 da camada de segurança em Problem Details (RFC 9457), sem redirecionar para página de login. */
public final class ProblemResponses {

    private ProblemResponses() {
    }

    public static AuthenticationEntryPoint unauthorized() {
        return (request, response, e) -> write(response, HttpStatus.UNAUTHORIZED, "Login necessário",
                "Entre na sua conta para continuar.");
    }

    public static AccessDeniedHandler denied() {
        return (request, response, e) -> write(response, HttpStatus.FORBIDDEN,
                e instanceof CsrfException ? "Sessão desatualizada" : "Sem permissão",
                e instanceof CsrfException
                        ? "Token CSRF ausente ou inválido. Recarregue a página e tente de novo."
                        : "Você não tem permissão para esta ação.");
    }

    static void write(HttpServletResponse response, HttpStatus status, String title, String detail) throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write("{\"type\":\"about:blank\",\"title\":\"" + title + "\",\"status\":" + status.value()
                + ",\"detail\":\"" + detail + "\"}");
    }
}
