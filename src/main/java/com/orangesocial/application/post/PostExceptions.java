package com.orangesocial.application.post;

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

    /** 409: o post existe, mas não aceita interações (arquivado). */
    public static class InteractionsClosed extends RuntimeException {
        public InteractionsClosed() {
            super("Este post está arquivado e não recebe mais curtidas, comentários ou compartilhamentos.");
        }
    }
}
