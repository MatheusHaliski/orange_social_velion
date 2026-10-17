package com.orangesocial.domain.model;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Validação de CNPJ, inclusive o alfanumérico (IN RFB 2.229/2024, emitido desde 07/2026):
 * 12 posições com dígitos ou letras maiúsculas + 2 dígitos verificadores numéricos.
 * Cada caractere vale seu código ASCII − 48 (A = 17) e o cálculo segue o módulo 11.
 * Só confere o formato; existência e situação cadastral vêm da consulta pública (moderação).
 */
public final class Cnpj {

    private static final Pattern FORMAT = Pattern.compile("^[0-9A-Z]{12}[0-9]{2}$");
    private static final int[] W1 = {5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2};
    private static final int[] W2 = {6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2};

    private Cnpj() {
    }

    /** Remove pontuação (". / -") e passa para maiúsculas. */
    public static String normalize(String raw) {
        return raw == null ? null : raw.replaceAll("[.\\-/\\s]", "").toUpperCase(Locale.ROOT);
    }

    public static boolean isValid(String raw) {
        String cnpj = normalize(raw);
        if (cnpj == null || !FORMAT.matcher(cnpj).matches() || cnpj.chars().distinct().count() == 1) {
            return false;
        }
        int d1 = digit(cnpj, W1);
        int d2 = digit(cnpj, W2);
        return cnpj.charAt(12) - '0' == d1 && cnpj.charAt(13) - '0' == d2;
    }

    private static int digit(String cnpj, int[] weights) {
        int sum = 0;
        for (int i = 0; i < weights.length; i++) {
            sum += (cnpj.charAt(i) - 48) * weights[i];
        }
        int rest = sum % 11;
        return rest < 2 ? 0 : 11 - rest;
    }
}
