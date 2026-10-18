package com.orangesocial.application.background;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.MonthDay;
import java.time.temporal.TemporalAdjusters;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.function.Predicate;

/**
 * Cartelas sazonais do Hemisfério Sul (RF28, PESQUISA_BACKGROUND_STUDIO.md §6.2). Janelas semiabertas
 * {@code [início, fim)} avaliadas na data de São Paulo; prioridade 1 vence 4 (data pontual > campanha > festa > estação).
 * Campanha comercial (Black Friday) nunca entra no modo automático: só por escolha da pessoa.
 */
public final class SeasonalCalendar {

    public record Season(String id, String name, String window, int priority, List<String> colors, boolean auto,
                         Predicate<LocalDate> active) {
    }

    public static final List<Season> SEASONS = List.of(
            fixed("verao", "Verão", "21/12–20/03", 4, "12-21", "03-20",
                    "#FFB703", "#FB8500", "#00B4D8", "#90E0EF", "#F4E1C1"),
            fixed("outono", "Outono", "20/03–21/06", 4, "03-20", "06-21",
                    "#C8553D", "#E09F3E", "#9E2A2B", "#7A6C5D", "#F2D0A4"),
            fixed("inverno", "Inverno", "21/06–22/09", 4, "06-21", "09-22",
                    "#2E4A62", "#7FA7C9", "#C9D6E3", "#8C6E5D", "#E8DCC8"),
            fixed("primavera", "Primavera (ipês)", "22/09–21/12", 4, "09-22", "12-21",
                    "#F6C90E", "#A05EB5", "#F28AB2", "#5CB85C", "#9AD0EC"),
            new Season("carnaval", "Carnaval", "sexta a Quarta de Cinzas (Páscoa − 51 a − 46)", 2,
                    List.of("#FF2E88", "#FFD23F", "#00C2A8", "#7B2FF7", "#FF6A2B"), true, SeasonalCalendar::isCarnaval),
            fixed("junina", "Festa Junina", "01/06–30/06", 3, "06-01", "07-01",
                    "#E63946", "#F4A261", "#2A9D8F", "#F1C453", "#8D5524"),
            fixed("namorados", "Dia dos Namorados", "05/06–12/06", 1, "06-05", "06-13",
                    "#E5383B", "#FF758F", "#FFB3C1", "#9D0208", "#FFF0F3"),
            fixed("patria", "Semana da Pátria", "01/09–07/09", 1, "09-01", "09-08",
                    "#009C3B", "#FFDF00", "#002776", "#3DA35D", "#F5EDE3"),
            fixed("outubro-rosa", "Outubro Rosa", "01/10–31/10", 2, "10-01", "11-01",
                    "#F48FB1", "#EC407A", "#AD1457", "#FCE4EC", "#6D2C4A"),
            fixed("novembro-azul", "Novembro Azul", "01/11–30/11", 2, "11-01", "12-01",
                    "#1E88E5", "#64B5F6", "#0D47A1", "#BBDEFB", "#263238"),
            new Season("black-friday", "Black Friday (só por escolha)", "dia seguinte à 4ª quinta de novembro", 1,
                    List.of("#2B2B2B", "#F7C948", "#FF6A2B", "#8A8F96", "#F5EDE3"), false, SeasonalCalendar::isBlackFriday),
            fixed("natal", "Natal e Réveillon", "01/12–06/01", 3, "12-01", "01-07",
                    "#C1121F", "#2D6A4F", "#E9C46A", "#F5EDE3", "#00B4D8"));

    private SeasonalCalendar() {
    }

    /** Cartela do modo "automática pela data": a de maior prioridade entre as ativas. */
    public static Optional<Season> activeOn(LocalDate date) {
        return SEASONS.stream()
                .filter(Season::auto)
                .filter(s -> s.active().test(date))
                .min(Comparator.comparingInt(Season::priority));
    }

    public static Optional<Season> byId(String id) {
        return SEASONS.stream().filter(s -> s.id().equals(id)).findFirst();
    }

    /** Domingo de Páscoa no calendário gregoriano (algoritmo de Meeus/Jones/Butcher). */
    public static LocalDate easter(int year) {
        int a = year % 19, b = year / 100, c = year % 100, d = b / 4, e = b % 4, f = (b + 8) / 25;
        int g = (b - f + 1) / 3, h = (19 * a + b - d - g + 15) % 30, i = c / 4, k = c % 4;
        int l = (32 + 2 * e + 2 * i - h - k) % 7, m = (a + 11 * h + 22 * l) / 451;
        int n = h + l - 7 * m + 114;
        return LocalDate.of(year, n / 31, n % 31 + 1);
    }

    /** Terça de Carnaval = Páscoa − 47; a janela vai da sexta (− 51) até a Quarta de Cinzas (− 46). */
    static boolean isCarnaval(LocalDate date) {
        LocalDate easter = easter(date.getYear());
        return !date.isBefore(easter.minusDays(51)) && date.isBefore(easter.minusDays(45));
    }

    static boolean isBlackFriday(LocalDate date) {
        LocalDate thanksgiving = LocalDate.of(date.getYear(), 11, 1)
                .with(TemporalAdjusters.dayOfWeekInMonth(4, DayOfWeek.THURSDAY));
        return date.equals(thanksgiving.plusDays(1));
    }

    private static Season fixed(String id, String name, String window, int priority, String from, String to,
                                String... colors) {
        MonthDay start = MonthDay.parse("--" + from);
        MonthDay end = MonthDay.parse("--" + to);
        Predicate<LocalDate> active = date -> {
            MonthDay md = MonthDay.from(date);
            return start.isBefore(end)
                    ? !md.isBefore(start) && md.isBefore(end)
                    : !md.isBefore(start) || md.isBefore(end);          // janela que vira o ano (verão, Natal)
        };
        return new Season(id, name, window, priority, List.of(colors), true, active);
    }
}
