package com.orangesocial.api;

import com.orangesocial.application.post.PostExceptions;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * Erros em Problem Details (RFC 9457) com mensagem em pt-BR pronta para o usuário.
 * Validação de corpo e JSON inválido ficam com o tratamento padrão do Spring (400).
 */
@RestControllerAdvice
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {

    @ExceptionHandler(PostExceptions.NotFound.class)
    ProblemDetail notFound(PostExceptions.NotFound e) {
        return problem(HttpStatus.NOT_FOUND, "Não encontrado", e.getMessage());
    }

    @ExceptionHandler(PostExceptions.Unauthenticated.class)
    ProblemDetail unauthenticated(PostExceptions.Unauthenticated e) {
        return problem(HttpStatus.UNAUTHORIZED, "Login necessário", e.getMessage());
    }

    @ExceptionHandler(PostExceptions.Forbidden.class)
    ProblemDetail forbidden(PostExceptions.Forbidden e) {
        return problem(HttpStatus.FORBIDDEN, "Sem permissão", e.getMessage());
    }

    @ExceptionHandler(PostExceptions.InteractionsClosed.class)
    ProblemDetail closed(PostExceptions.InteractionsClosed e) {
        return problem(HttpStatus.CONFLICT, "Interações encerradas", e.getMessage());
    }

    /** Cursor inválido, comentário vazio após remover espaços, etc. */
    @ExceptionHandler(IllegalArgumentException.class)
    ProblemDetail badRequest(IllegalArgumentException e) {
        return problem(HttpStatus.BAD_REQUEST, "Pedido inválido", e.getMessage());
    }

    private static ProblemDetail problem(HttpStatus status, String title, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setTitle(title);
        return problem;
    }
}
