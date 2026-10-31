package com.orangesocial.application.account;

import java.time.Duration;
import java.util.List;

/** Erros de conta e autenticação; o {@code ApiExceptionHandler} os traduz em Problem Details com texto em pt-BR. */
public final class AccountExceptions {

    private AccountExceptions() {
    }

    /** 401 com mensagem neutra: nunca diz se o e-mail existe (OWASP Authentication). */
    public static class BadCredentials extends RuntimeException {
        public BadCredentials() {
            super("E-mail ou senha incorretos.");
        }

        public BadCredentials(String message) {
            super(message);
        }
    }

    /** 429 + Retry-After. */
    public static class TooManyAttempts extends RuntimeException {
        private final Duration retryAfter;

        public TooManyAttempts(Duration retryAfter) {
            super("Muitas tentativas. Tente de novo em " + human(retryAfter) + " ou redefina sua senha.");
            this.retryAfter = retryAfter;
        }

        public Duration retryAfter() {
            return retryAfter;
        }

        private static String human(Duration d) {
            long s = Math.max(1, d.toSeconds());
            return s < 60 ? s + " segundos" : ((s + 59) / 60) + " minutos";
        }
    }

    /** 403: conta suspensa, etapa fora de ordem, ação bloqueada por idade (ECA Digital). */
    public static class Forbidden extends RuntimeException {
        public Forbidden(String message) {
            super(message);
        }
    }

    /** 404: recurso da própria conta que não existe (ex.: finalidade de consentimento desconhecida, RF3). */
    public static class NotFound extends RuntimeException {
        public NotFound(String message) {
            super(message);
        }
    }

    /** 409: e-mail ou @usuário em uso, 2FA já ativo. */
    public static class Conflict extends RuntimeException {
        public Conflict(String message) {
            super(message);
        }
    }

    /** 422: dados de cadastro ou perfil que não passam nas regras (lista de problemas em {@code errors}). */
    public static class Invalid extends RuntimeException {
        private final List<String> errors;

        public Invalid(List<String> errors) {
            super(errors.size() == 1 ? errors.getFirst() : "Revise os campos destacados.");
            this.errors = List.copyOf(errors);
        }

        public Invalid(String error) {
            this(List.of(error));
        }

        public List<String> errors() {
            return errors;
        }
    }
}
