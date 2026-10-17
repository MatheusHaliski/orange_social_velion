package com.orangesocial.domain.model;

/** Reações a um post (tabela post_reaction). */
public enum ReactionKind {
    /** Curtida: pública e contada em post.like_count. */
    LIKE,
    /** Salvar: privada; só o próprio usuário sabe que salvou. */
    SAVE
}
