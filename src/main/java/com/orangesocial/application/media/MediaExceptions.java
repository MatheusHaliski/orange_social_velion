package com.orangesocial.application.media;

import java.util.List;

/** Erros do envio de mídia; o {@code ApiExceptionHandler} os traduz em Problem Details com texto em pt-BR. */
public final class MediaExceptions {

    private MediaExceptions() {
    }

    /** 403: conta que ainda não pode enviar arquivos. */
    public static class Forbidden extends RuntimeException {
        public Forbidden(String message) {
            super(message);
        }
    }

    /** 422: tipo, tamanho ou arquivo recusado (lista de problemas em {@code errors}). */
    public static class Invalid extends RuntimeException {
        private final List<String> errors;

        public Invalid(List<String> errors) {
            super(String.join(" ", errors));
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
