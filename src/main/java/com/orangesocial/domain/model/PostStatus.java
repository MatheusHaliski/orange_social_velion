package com.orangesocial.domain.model;

import java.util.EnumSet;
import java.util.Set;

/**
 * Ciclo de vida da postagem (ver docs/MAQUINA_ESTADOS.md §2). "Trending" não é um status
 * persistido: é derivado do ranking no Valkey.
 */
public enum PostStatus {

    DRAFT,
    PUBLISHED,
    ARCHIVED,
    /** Terminal: moderação ou eliminação do autor (LGPD). O conteúdo é apagado. */
    REMOVED;

    /** Status que aparecem no feed do autor (RF25) e abrem no detalhe (RF24). */
    public static final Set<PostStatus> PUBLIC = EnumSet.of(PUBLISHED, ARCHIVED);

    public Set<PostStatus> allowedTransitions() {
        return switch (this) {
            case DRAFT -> EnumSet.of(PUBLISHED, REMOVED);
            case PUBLISHED -> EnumSet.of(ARCHIVED, REMOVED);
            case ARCHIVED -> EnumSet.of(PUBLISHED, REMOVED);
            case REMOVED -> EnumSet.noneOf(PostStatus.class);
        };
    }

    public boolean canTransitionTo(PostStatus target) {
        return allowedTransitions().contains(target);
    }
}
