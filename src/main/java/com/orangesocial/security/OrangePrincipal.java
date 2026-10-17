package com.orangesocial.security;

import java.io.Serializable;
import java.security.Principal;

/**
 * Quem está logado. Vai serializado para a sessão no Valkey e guarda só o id — que é também o nome do principal
 * indexado pelo Spring Session para listar e encerrar as sessões do usuário. Nenhum dado pessoal na sessão.
 */
public record OrangePrincipal(long userId) implements Principal, Serializable {

    @Override
    public String getName() {
        return Long.toString(userId);
    }
}
