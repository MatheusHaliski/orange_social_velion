package com.orangesocial.domain.model;

import java.util.EnumSet;
import java.util.Set;

/**
 * Ciclo de vida da conta (ver docs/MAQUINA_ESTADOS.md).
 */
public enum AccountStatus {

    PENDING_VERIFICATION,
    ACTIVE,
    SUSPENDED,
    /** Exclusão pedida pelo titular: 30 dias para reativar; conta invisível e sem sessões. */
    PENDING_DELETION,
    /** Estado terminal: dados pessoais eliminados/anonimizados (LGPD Art. 18, VI). */
    ANONYMOUS_LGPD_DELETED;

    public Set<AccountStatus> allowedTransitions() {
        return switch (this) {
            case PENDING_VERIFICATION -> EnumSet.of(ACTIVE, PENDING_DELETION, ANONYMOUS_LGPD_DELETED);
            case ACTIVE -> EnumSet.of(SUSPENDED, PENDING_DELETION, ANONYMOUS_LGPD_DELETED);
            case SUSPENDED -> EnumSet.of(ACTIVE, PENDING_DELETION, ANONYMOUS_LGPD_DELETED);
            // reativar devolve a conta ao status que ela tinha antes do pedido
            case PENDING_DELETION -> EnumSet.of(PENDING_VERIFICATION, ACTIVE, SUSPENDED, ANONYMOUS_LGPD_DELETED);
            case ANONYMOUS_LGPD_DELETED -> EnumSet.noneOf(AccountStatus.class);
        };
    }

    public boolean canTransitionTo(AccountStatus target) {
        return allowedTransitions().contains(target);
    }
}
