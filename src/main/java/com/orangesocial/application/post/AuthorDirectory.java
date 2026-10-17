package com.orangesocial.application.post;

import com.orangesocial.application.post.PostViews.AuthorView;
import com.orangesocial.application.post.PostViews.CategoryView;
import com.orangesocial.domain.model.AccountStatus;
import com.orangesocial.domain.model.UserControlList;
import com.orangesocial.infrastructure.persistence.postgres.UserControlListRepository;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Resolve o "dono" de posts e comentários para a visão pública (foto, nome, categoria, link). */
@Component
class AuthorDirectory {

    static final String DELETED_NAME = "Conta excluída";

    private final UserControlListRepository users;
    private final PublicLinks links;

    AuthorDirectory(UserControlListRepository users, PublicLinks links) {
        this.users = users;
        this.links = links;
    }

    Optional<UserControlList> find(Long userId) {
        return users.findById(userId);
    }

    /** Uma consulta para todos os autores da página (evita N+1 na lista de comentários). */
    Map<Long, UserControlList> findAll(Collection<Long> userIds) {
        return users.findAllById(userIds).stream()
                .collect(Collectors.toMap(UserControlList::getId, Function.identity()));
    }

    static boolean isPublic(UserControlList user) {
        return user.getAccountStatus() == AccountStatus.ACTIVE;
    }

    /**
     * Conta ativa: nome, foto e link para o perfil. Conta eliminada (LGPD): "Conta excluída", sem foto
     * e sem link. Suspensa: nome sem link (o perfil não abre enquanto durar a suspensão).
     */
    AuthorView view(UserControlList user) {
        if (user == null || user.getAccountStatus() == AccountStatus.ANONYMOUS_LGPD_DELETED) {
            return new AuthorView(user == null ? null : user.getId(), DELETED_NAME, null, null, null, false);
        }
        boolean available = isPublic(user);
        return new AuthorView(user.getId(), user.getName(), CategoryView.of(user.getUserType()),
                links.mediaUrl(user.getPhotoObjectKey()),
                available ? links.profilePath(user.getId()) : null, available);
    }
}
