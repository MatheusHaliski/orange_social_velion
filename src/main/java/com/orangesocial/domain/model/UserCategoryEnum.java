package com.orangesocial.domain.model;

import java.util.Arrays;

/**
 * Categoria visual do usuário (campo {@code Usertype}).
 * A cor é exibida como "bolinha" no card e serve de eixo de filtro nos feeds.
 */
public enum UserCategoryEnum {

    VERDE('A', "#3DDC6B", "Pessoa Física", "Indivíduo comum"),
    AMARELO('B', "#F7C948", "Networking", "Imprensa, fórum, noticiário, blog, networking"),
    AZUL('C', "#4A93FF", "Marketing", "Marketing e propaganda"),
    LARANJA('D', "#FF9F1C", "Comunidade", "Igrejas, clubes esportivos, clubes e grupos"),
    VERMELHO('E', "#FF4D4D", "Instituição", "Instituições governamentais, empresas e marcas"),
    PRETO('F', "#0C0A07", "Especial", "Amigos próximos, eventos, situações especiais e bancos");

    private final char code;
    private final String hexColor;
    private final String label;
    private final String description;

    UserCategoryEnum(char code, String hexColor, String label, String description) {
        this.code = code;
        this.hexColor = hexColor;
        this.label = label;
        this.description = description;
    }

    public char getCode() {
        return code;
    }

    public String getHexColor() {
        return hexColor;
    }

    public String getLabel() {
        return label;
    }

    public String getDescription() {
        return description;
    }

    /** Apenas instituições verificadas publicam diretamente no Alert Feed. */
    public boolean canPublishOfficialAlerts() {
        return this == VERMELHO;
    }

    public static UserCategoryEnum fromCode(char code) {
        char normalized = Character.toUpperCase(code);
        return Arrays.stream(values())
                .filter(c -> c.code == normalized)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Categoria desconhecida: " + code));
    }
}
