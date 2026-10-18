package com.orangesocial.application.background;

import com.orangesocial.application.post.PostExceptions;
import com.orangesocial.domain.model.FeedType;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** RF28: cartelas do Hemisfério Sul, regras da moldura e contraste — sem Spring. */
class BackgroundRulesTest {

    final BackgroundCatalog catalog = new BackgroundCatalog("https://cdn.example/backgrounds");
    final BackgroundValidator validator = new BackgroundValidator(catalog);
    final BackgroundValidator.Context post = new BackgroundValidator.Context(FeedType.POST, false);

    // ------------------------------------------------------------ cartela sazonal

    @Test
    void carnavalComesFromEasterMinus47AndCoversFridayToAshWednesday() {
        assertThat(SeasonalCalendar.easter(2026)).isEqualTo(LocalDate.of(2026, 4, 5));
        assertThat(SeasonalCalendar.easter(2027)).isEqualTo(LocalDate.of(2027, 3, 28));
        assertThat(SeasonalCalendar.easter(2028)).isEqualTo(LocalDate.of(2028, 4, 16));
        assertThat(SeasonalCalendar.easter(2026).minusDays(47)).isEqualTo(LocalDate.of(2026, 2, 17));
        assertThat(SeasonalCalendar.easter(2028).minusDays(47)).isEqualTo(LocalDate.of(2028, 2, 29));   // ano bissexto

        assertThat(active(2026, 2, 13)).isEqualTo("carnaval");    // sexta
        assertThat(active(2026, 2, 18)).isEqualTo("carnaval");    // Quarta de Cinzas
        assertThat(active(2026, 2, 19)).isEqualTo("verao");
        assertThat(active(2026, 2, 12)).isEqualTo("verao");
    }

    @Test
    void higherPriorityWinsAndWindowsAreHalfOpen() {
        assertThat(active(2026, 10, 17)).isEqualTo("outubro-rosa");   // campanha (2) vence primavera (4)
        assertThat(active(2026, 6, 12)).isEqualTo("namorados");       // data pontual (1) vence Junina (3)
        assertThat(active(2026, 6, 13)).isEqualTo("junina");
        assertThat(active(2026, 9, 7)).isEqualTo("patria");
        assertThat(active(2026, 9, 8)).isEqualTo("inverno");
        assertThat(active(2026, 12, 1)).isEqualTo("natal");           // festa (3) vence primavera (4)
        assertThat(active(2027, 1, 6)).isEqualTo("natal");            // janela que vira o ano
        assertThat(active(2027, 1, 7)).isEqualTo("verao");
        assertThat(active(2026, 3, 20)).isEqualTo("outono");          // [início, fim): 20/03 já é outono
    }

    @Test
    void blackFridayIsNeverAutomatic() {
        assertThat(SeasonalCalendar.isBlackFriday(LocalDate.of(2026, 11, 27))).isTrue();
        assertThat(SeasonalCalendar.isBlackFriday(LocalDate.of(2027, 11, 26))).isTrue();
        assertThat(active(2026, 11, 27)).isEqualTo("novembro-azul");
        assertThat(SeasonalCalendar.byId("black-friday")).get().extracting(SeasonalCalendar.Season::auto).isEqualTo(false);
    }

    // ------------------------------------------------------------ validação da moldura

    @Test
    void canonicalFormFillsDefaultsAndKeepsOnlyIds() {
        Map<String, Object> out = validator.validate(Map.of("auraPlusId", "brasa"), post);
        assertThat(out).containsEntry("v", 1).containsEntry("auraPlusId", "brasa").containsEntry("layoutId", "CLASSICO")
                .containsEntry("skinId", "PADRAO").containsEntry("auraHypeStyle", "OFF").containsEntry("animationId", "NONE");
        assertThat(out.keySet()).containsExactly("v", "color", "gradientId", "seasonal", "animationId", "aura", "auraPlusId",
                "auraHypeStyle", "metamorphose", "materialId", "customArt", "layoutId", "skinId", "container");
        assertThat(validator.validate(null, post)).isNull();
    }

    @Test
    void rejectsUnknownKeysCssUrlsAndIdsOutsideTheCatalog() {
        assertThat(errors(Map.of("gradient", "linear-gradient(red,blue)"))).anyMatch(e -> e.contains("\"background.gradient\""));
        assertThat(errors(Map.of("aura", Map.of("presetId", "eclipse", "url", "https://evil.example/x.gif"))))
                .anyMatch(e -> e.contains("aura.url"));
        assertThat(errors(Map.of("gradientId", "arco-iris"))).anyMatch(e -> e.contains("Gradiente desconhecido"));
        assertThat(errors(Map.of("color", "#3DDC6B"))).anyMatch(e -> e.contains("fora do catálogo"));   // cor de categoria
    }

    @Test
    void oneArtSourceAndPosterLayoutDoesNotMixWithOtherArt() {
        assertThat(errors(Map.of("gradientId", "oceano", "aura", Map.of("presetId", "mare"))))
                .anyMatch(e -> e.contains("única arte"));
        assertThat(errors(Map.of("layoutId", "POSTER", "materialId", "vidro"))).anyMatch(e -> e.contains("Pôster"));
        assertThat(errors(Map.of("seasonal", Map.of("presetId", "natal", "auto", true)))).anyMatch(e -> e.contains("não os dois"));
        assertThat(validator.validate(Map.of("layoutId", "POSTER", "skinId", "MONO"), post)).containsEntry("layoutId", "POSTER");
    }

    @Test
    void alertsHaveNoFrameAndMinorsCannotUseCustomArt() {
        assertThatThrownBy(() -> validator.validate(Map.of("color", "#2B2217"),
                new BackgroundValidator.Context(FeedType.ALERT, false)))
                .isInstanceOf(PostExceptions.Invalid.class).hasMessageContaining("Alertas oficiais");
        assertThatThrownBy(() -> validator.validate(Map.of("customArt", Map.of("assetId", "a1", "origin", "IA")),
                new BackgroundValidator.Context(FeedType.POST, true)))
                .isInstanceOf(PostExceptions.Forbidden.class).hasMessageContaining("ECA Digital");
        assertThat(errors(Map.of("customArt", Map.of("assetId", "a1", "origin", "UPLOAD")))).anyMatch(e -> e.contains("OS-70"));
    }

    @Test
    void containerInkNeedsAaContrastAndSuggestsTheBetterInk() {
        Map<String, Object> bad = Map.of("container", Map.of("color", "#F5EDE3", "ink", "#FF9D5E"));
        assertThat(errors(bad)).anyMatch(e -> e.contains("1,8:1") && e.contains("#17120D") && e.endsWith(")."));
        assertThat(validator.validate(Map.of("container", Map.of("color", "#FF6A2B", "ink", "AUTO")), post))
                .extracting(m -> ((Map<?, ?>) m.get("container")).get("ink")).isEqualTo("AUTO");
        assertThat(Contrast.bestInk("#FF6A2B")).isEqualTo(Contrast.DARK_INK);
        assertThat(Contrast.ratio(Contrast.DARK_INK, "#FF6A2B")).isGreaterThan(6.4);
    }

    @Test
    void catalogVersionIsStableAndAuraPlusPointsToVideoAndPoster() {
        BackgroundCatalog again = new BackgroundCatalog("https://cdn.example/backgrounds/");
        assertThat(again.version()).isEqualTo(catalog.version());
        BackgroundCatalog.AuraPlus brasa = catalog.auraPlusById().get("brasa");
        assertThat(brasa.av1()).isEqualTo("https://cdn.example/backgrounds/aura-plus/brasa-hq.mp4");
        assertThat(brasa.poster()).endsWith("brasa-poster.webp");
        assertThat(catalog.view(LocalDate.of(2026, 10, 17)).activeSeasonId()).isEqualTo("outubro-rosa");
    }

    private static String active(int y, int m, int d) {
        return SeasonalCalendar.activeOn(LocalDate.of(y, m, d)).orElseThrow().id();
    }

    private List<String> errors(Map<String, Object> raw) {
        try {
            validator.validate(new HashMap<>(raw), post);
        } catch (PostExceptions.Invalid e) {
            return e.errors();
        }
        throw new AssertionError("esperava 422 para " + raw);
    }
}
