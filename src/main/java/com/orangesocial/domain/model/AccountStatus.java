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
    /** Estado terminal: dados pessoais eliminados/anonimizados (LGPD Art. 18, VI). */
    ANONYMOUS_LGPD_DELETED;

    public Set<AccountStatus> allowedTransitions() {
        return switch (this) {
            case PENDING_VERIFICATION -> EnumSet.of(ACTIVE, ANONYMOUS_LGPD_DELETED);
            case ACTIVE -> EnumSet.of(SUSPENDED, ANONYMOUS_LGPD_DELETED);
            case SUSPENDED -> EnumSet.of(ACTIVE, ANONYMOUS_LGPD_DELETED);
            case ANONYMOUS_LGPD_DELETED -> EnumSet.noneOf(AccountStatus.class);
        };
    }

    public boolean canTransitionTo(AccountStatus target) {
        return allowedTransitions().contains(target);
    }
}
