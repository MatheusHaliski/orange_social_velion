package com.orangesocial.application.background;

import java.util.regex.Pattern;

/** Contraste WCAG 2.x entre duas cores {@code #RRGGBB} — o mesmo cálculo de {@code scripts/wcag_contrast.py}. */
public final class Contrast {

    public static final double AA_TEXT = 4.5;
    public static final String LIGHT_INK = "#F5EDE3";
    public static final String DARK_INK = "#17120D";
    private static final Pattern HEX = Pattern.compile("^#[0-9A-Fa-f]{6}$");

    private Contrast() {
    }

    public static boolean isHex(Object value) {
        return value instanceof String s && HEX.matcher(s).matches();
    }

    public static double ratio(String a, String b) {
        double la = luminance(a), lb = luminance(b);
        return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    }

    /** Tinta automática: entre a clara e a escura do Orange, a de maior contraste com o fundo. */
    public static String bestInk(String background) {
        return ratio(LIGHT_INK, background) >= ratio(DARK_INK, background) ? LIGHT_INK : DARK_INK;
    }

    /** "4,5:1" — uma casa decimal com vírgula, como o app mostra. */
    public static String format(double ratio) {
        return String.format(java.util.Locale.ROOT, "%.1f", ratio).replace('.', ',') + ":1";
    }

    static double luminance(String hex) {
        double r = channel(Integer.parseInt(hex.substring(1, 3), 16));
        double g = channel(Integer.parseInt(hex.substring(3, 5), 16));
        double b = channel(Integer.parseInt(hex.substring(5, 7), 16));
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    private static double channel(int value) {
        double c = value / 255.0;
        return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
}
