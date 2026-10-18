package com.orangesocial.api;

import com.orangesocial.application.account.AccountExceptions;
import com.orangesocial.application.post.PostExceptions;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
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

    @ExceptionHandler(PostExceptions.Invalid.class)
    ProblemDetail postInvalid(PostExceptions.Invalid e) {
        ProblemDetail p = problem(HttpStatus.UNPROCESSABLE_CONTENT, "Revise o post", e.getMessage());
        p.setProperty("errors", e.errors());
        return p;
    }

    @ExceptionHandler(PostExceptions.Conflict.class)
    ProblemDetail postConflict(PostExceptions.Conflict e) {
        return problem(HttpStatus.CONFLICT, "Ação não disponível agora", e.getMessage());
    }

    @ExceptionHandler(PostExceptions.InteractionsClosed.class)
    ProblemDetail closed(PostExceptions.InteractionsClosed e) {
        return problem(HttpStatus.CONFLICT, "Interações encerradas", e.getMessage());
    }

    // ------------------------------------------------------------ conta e autenticação (RF1, RF27)

    @ExceptionHandler(AccountExceptions.BadCredentials.class)
    ProblemDetail badCredentials(AccountExceptions.BadCredentials e) {
        return problem(HttpStatus.UNAUTHORIZED, "Não foi possível entrar", e.getMessage());
    }

    @ExceptionHandler(AccountExceptions.TooManyAttempts.class)
    ResponseEntity<ProblemDetail> tooMany(AccountExceptions.TooManyAttempts e) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header(HttpHeaders.RETRY_AFTER, Long.toString(Math.max(1, e.retryAfter().toSeconds())))
                .body(problem(HttpStatus.TOO_MANY_REQUESTS, "Muitas tentativas", e.getMessage()));
    }

    @ExceptionHandler(AccountExceptions.Forbidden.class)
    ProblemDetail accountForbidden(AccountExceptions.Forbidden e) {
        return problem(HttpStatus.FORBIDDEN, "Ação não permitida", e.getMessage());
    }

    @ExceptionHandler(AccountExceptions.Conflict.class)
    ProblemDetail conflict(AccountExceptions.Conflict e) {
        return problem(HttpStatus.CONFLICT, "Conflito", e.getMessage());
    }

    /** 422 com todos os problemas de uma vez em {@code errors}, para o formulário marcar cada campo. */
    @ExceptionHandler(AccountExceptions.Invalid.class)
    ProblemDetail invalid(AccountExceptions.Invalid e) {
        ProblemDetail p = problem(HttpStatus.UNPROCESSABLE_CONTENT, "Revise os dados", e.getMessage());
        p.setProperty("errors", e.errors());
        return p;
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
