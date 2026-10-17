package com.orangesocial.api;

import com.orangesocial.application.post.PostExceptions;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Quem está vendo/agindo. Até o login com Keycloak (card OS-13) não há sessão: todo pedido é
 * anônimo — leitura funciona e escrita responde 401.
 *
 * <p>Somente em desenvolvimento e nos testes de integração, {@code orange-social.auth.dev-header-enabled=true}
 * aceita o usuário no cabeçalho {@value #DEV_HEADER}. Isso permite que qualquer cliente se passe por
 * qualquer usuário: NUNCA ligar em produção. Será removido quando o OS-13 entrar.
 */
@Component
public class ViewerResolver {

    public static final String DEV_HEADER = "X-Orange-Dev-User";

    private static final Logger log = LoggerFactory.getLogger(ViewerResolver.class);

    private final boolean devHeaderEnabled;

    public ViewerResolver(@Value("${orange-social.auth.dev-header-enabled:false}") boolean devHeaderEnabled) {
        this.devHeaderEnabled = devHeaderEnabled;
        if (devHeaderEnabled) {
            log.warn("orange-social.auth.dev-header-enabled=true: identidade vem do cabeçalho {} sem autenticação. "
                    + "Apenas para desenvolvimento local e testes.", DEV_HEADER);
        }
    }

    public Optional<Long> viewerId(HttpServletRequest request) {
        if (!devHeaderEnabled) {
            return Optional.empty();
        }
        String header = request.getHeader(DEV_HEADER);
        if (header == null || header.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.of(Long.parseLong(header.strip()));
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }

    public long requireViewer(HttpServletRequest request) {
        return viewerId(request).orElseThrow(PostExceptions.Unauthenticated::new);
    }
}
