package com.orangesocial.security;

import jakarta.servlet.http.HttpSession;

import java.io.Serializable;
import java.time.Instant;

/**
 * Etapa intermediária do login guardada na sessão, sem autenticar: a senha já foi conferida e falta o código
 * do 2FA ({@link Step#MFA}) ou a escolha de reativar a conta em exclusão ({@link Step#REACTIVATION}).
 * Vale 5 minutos e aceita 5 tentativas de código; depois disso volta para a senha.
 */
public record PendingLogin(long userId, Step step, Instant expiresAt, int attempts) implements Serializable {

    public static final String ATTRIBUTE = "orange.pendingLogin";
    public static final int MAX_ATTEMPTS = 5;

    public enum Step { MFA, REACTIVATION }

    public static PendingLogin get(HttpSession session) {
        return session == null ? null : (PendingLogin) session.getAttribute(ATTRIBUTE);
    }

    public static void clear(HttpSession session) {
        session.removeAttribute(ATTRIBUTE);
    }

    public boolean expired(Instant now) {
        return now.isAfter(expiresAt);
    }

    public PendingLogin withFailure() {
        return new PendingLogin(userId, step, expiresAt, attempts + 1);
    }
}
