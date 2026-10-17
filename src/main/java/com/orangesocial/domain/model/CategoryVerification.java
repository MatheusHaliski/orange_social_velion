package com.orangesocial.domain.model;

/** Selo da categoria (docs/PESQUISA_DADOS_USUARIO.md §1, regra 7): identidade verificada, nunca assinatura paga. */
public enum CategoryVerification {
    /** VERDE, AMARELO, AZUL e LARANJA publicam sem selo; o selo é opcional. */
    NOT_REQUIRED,
    /** VERMELHO e PRETO/banco: aguardando a moderação conferir CNPJ, domínio e representante. */
    PENDING,
    VERIFIED,
    REJECTED
}
