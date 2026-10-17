package com.orangesocial.domain.model;

/** Classificação do conteúdo; o chip do card sempre mostra o rótulo em texto (DESIGN_SYSTEM.md §4). */
public enum AgeRating {

    LIVRE("Livre"),
    AGE_12("12+"),
    AGE_16("16+"),
    AGE_18("18+"),
    SENSITIVE("Sensível");

    private final String label;

    AgeRating(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
