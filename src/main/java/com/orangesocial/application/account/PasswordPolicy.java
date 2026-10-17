package com.orangesocial.application.account;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Política de senha (NIST SP 800-63B-4 / OWASP): comprimento manda, sem regra de "1 maiúscula + 1 símbolo".
 * 12 a 128 caracteres, não pode conter o e-mail nem o @usuário, e não pode estar entre as mais comuns.
 */
public final class PasswordPolicy {

    public static final int MIN = 12;
    public static final int MAX = 128;

    private static final Set<String> COMMON = Set.of(
            "123456789012", "password1234", "senha1234567", "qwertyuiop12", "orangesocial", "orange123456",
            "abcdefghijkl", "111111111111", "000000000000", "iloveyou1234", "brasil123456", "velion123456");

    private PasswordPolicy() {
    }

    public static List<String> problems(String password, String email, String handle) {
        List<String> out = new ArrayList<>();
        if (password == null || password.codePointCount(0, password.length()) < MIN) {
            out.add("A senha precisa ter pelo menos " + MIN + " caracteres. Uma frase com várias palavras funciona bem.");
            return out;
        }
        if (password.length() > MAX) {
            out.add("A senha pode ter no máximo " + MAX + " caracteres.");
        }
        String lower = password.toLowerCase(Locale.ROOT);
        if (COMMON.contains(lower) || lower.chars().distinct().count() < 4) {
            out.add("Essa senha é fácil de adivinhar. Escolha outra.");
        }
        String local = email == null ? "" : email.split("@")[0].toLowerCase(Locale.ROOT);
        if (local.length() >= 4 && lower.contains(local) || handle != null && handle.length() >= 4 && lower.contains(handle)) {
            out.add("A senha não pode conter seu e-mail ou @usuário.");
        }
        return out;
    }
}
