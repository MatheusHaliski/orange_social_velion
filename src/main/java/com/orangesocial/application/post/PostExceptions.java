package com.orangesocial.application.post;

import java.util.List;

/** Erros de negócio dos posts; o {@code ApiExceptionHandler} os traduz em Problem Details (RFC 9457). */
public final class PostExceptions {

    private PostExceptions() {
    }

    /** 404: inexistente, removido ou rascunho de outra pessoa — não revela qual dos três. */
    public static class NotFound extends RuntimeException {
        public NotFound(String message) {
            super(message);
        }
    }

    /** 401: ação exige usuário identificado. */
    public static class Unauthenticated extends RuntimeException {
        public Unauthenticated() {
            super("Entre na sua conta para interagir com posts.");
        }
    }

    /** 403: conta sem permissão (não ativa) ou ação sobre conteúdo de outra pessoa. */
    public static class Forbidden extends RuntimeException {
        public Forbidden(String message) {
            super(message);
        }
    }

    /** 422: dados do post ou da moldura inválidos; todos os problemas vão juntos em {@code errors}. */
    public static class Invalid extends RuntimeException {
        private final List<String> errors;

        public Invalid(List<String> errors) {
            super(errors.isEmpty() ? "Dados inválidos." : errors.getFirst());
            this.errors = List.copyOf(errors);
        }

        public List<String> errors() {
            return errors;
        }
    }

    /** 409: transição de estado que o post não aceita (ex.: arquivar um post já arquivado). */
    public static class Conflict extends RuntimeException {
        public Conflict(String message) {
            super(message);
        }
    }

    /** 409: o post existe, mas não aceita interações (arquivado). */
    public static class InteractionsClosed extends RuntimeException {
        public InteractionsClosed() {
            super("Este post está arquivado e não recebe mais curtidas, comentários ou compartilhamentos.");
        }
    }
}
