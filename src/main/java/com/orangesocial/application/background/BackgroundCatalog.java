package com.orangesocial.application.background;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Catálogo procedural da moldura do post (RF28): tudo é arte da própria Velion (CSS/SVG/Skia) ou vídeo gerado por
 * {@code design/brand/auras/gerar_aura_plus.py} — nada de banco de imagens de terceiros (PESQUISA_BACKGROUND_STUDIO.md §5).
 * Os ids são os mesmos do protótipo. O post guarda só ids; a versão muda quando o catálogo muda.
 */
@Component
public class BackgroundCatalog {

    public record Item(String id, String name, String css, List<String> palette) {
    }

    public record Aura(String id, String name, String archetype, List<String> palette, String technique, String css) {
    }

    public record AuraPlus(String id, String name, String archetype, String poster, String av1, String h264,
                           int loopSeconds) {
    }

    public record SeasonView(String id, String name, String window, int priority, List<String> colors, boolean auto) {
    }

    public record Layout(String id, String name, boolean ownArt) {
    }

    public record Skin(String id, String name, String containerColor) {
    }

    public record CatalogView(String version, String activeSeasonId, List<Item> colors, List<Item> gradients,
                              List<SeasonView> seasons, List<Item> animations, List<Aura> auras,
                              List<AuraPlus> auraPlus, List<Item> materials, List<String> hypeStyles,
                              List<String> metamorphoseModes, List<Layout> layouts, List<Skin> skins,
                              List<Item> containerColors, Rules rules) {
    }

    /** Regras que o cliente precisa saber para não mandar algo que o servidor recusa. */
    public record Rules(double minContrast, int maxConfigBytes, int maxAnimationSeconds, List<String> feedsWithoutFrame) {
    }

    static final List<Item> COLORS = List.of(
            color("#2B2217", "Café"), color("#3B1F33", "Ameixa"), color("#1E2A38", "Noite"), color("#24382E", "Musgo"),
            color("#5B3A29", "Telha"), color("#FF6A2B", "Orange"), color("#E9C46A", "Mel"), color("#F5EDE3", "Areia clara"));

    static final List<Item> GRADIENTS = List.of(
            new Item("por-do-sol", "Pôr do sol", "linear-gradient(135deg,#FF6A2B,#C1121F 55%,#3A0E0A)", List.of("#FF6A2B", "#C1121F", "#3A0E0A")),
            new Item("oceano", "Oceano", "linear-gradient(135deg,#00B4D8,#0D47A1)", List.of("#00B4D8", "#0D47A1")),
            new Item("uva", "Uva", "linear-gradient(135deg,#7B2FF7,#2E1A47)", List.of("#7B2FF7", "#2E1A47")),
            new Item("mate", "Mate", "linear-gradient(135deg,#95D5B2,#2D6A4F)", List.of("#95D5B2", "#2D6A4F")),
            new Item("caramelo", "Caramelo", "linear-gradient(135deg,#E9C46A,#8D5524)", List.of("#E9C46A", "#8D5524")),
            new Item("grafite", "Grafite", "linear-gradient(135deg,#4A4A4A,#141414)", List.of("#4A4A4A", "#141414")));

    /** Animação leve da arte: toca uma vez, no máximo 5 s, e para com "Reduzir movimento". */
    static final List<Item> ANIMATIONS = List.of(
            new Item("NONE", "Sem animação", null, List.of()),
            new Item("RESPIRAR", "Respirar", "scale 1 → 1,06, 2 × 2,4 s", List.of()),
            new Item("DERIVA", "Deriva", "background-position 0 → 100 %, 4,8 s", List.of()));

    static final List<Aura> AURAS = List.of(
            new Aura("eclipse", "Eclipse", "Mago", List.of("#7B2FF7", "#4A93FF", "#1A1033", "#F5EDE3"),
                    "aurora + constelação gerada com a seed do post", null),
            new Aura("entardecer", "Entardecer", "Amante", List.of("#FF758F", "#FF6A2B", "#9D0208", "#FFB3C1"), "mesh quente",
                    "radial-gradient(70% 60% at 15% 85%,#FF6A2Bcc,#0000 70%),radial-gradient(60% 50% at 85% 20%,#FF758Fbb,#0000 70%),radial-gradient(50% 50% at 50% 50%,#9D0208aa,#0000 75%),#2A0F12"),
            new Aura("mare", "Maré", "Inocente", List.of("#90E0EF", "#00B4D8", "#0077B6", "#F5EDE3"), "ondas",
                    "radial-gradient(120% 60% at 50% 120%,#0077B6,#0000 60%),repeating-linear-gradient(170deg,#90E0EF2e 0 9px,#0000 9px 22px),linear-gradient(180deg,#00B4D866,#0B2233)"),
            new Aura("varanda", "Varanda", "Cara comum", List.of("#E76F51", "#2A9D8F", "#F4A261", "#F1FAEE"), "azulejo",
                    "conic-gradient(from 45deg,#E76F51 0 25%,#F4A261 0 50%,#2A9D8F 0 75%,#F1FAEE 0) 0 0/18px 18px"),
            new Aura("ouro-velho", "Ouro Velho", "Governante", List.of("#E9C46A", "#B08D57", "#2B2118", "#F5EDE3"), "metal escovado",
                    "repeating-linear-gradient(90deg,#ffffff12 0 1px,#0000001a 1px 3px),conic-gradient(from 20deg,#B08D57,#E9C46A 12%,#7A5C2E 25%,#F3DFA2 40%,#6B4F2A 55%,#E9C46A 72%,#8C6A3A 88%,#B08D57)"),
            new Aura("confete", "Confete", "Bobo da corte", List.of("#FF2E88", "#F7C948", "#3DDC6B", "#4A93FF", "#FF6A2B"),
                    "confete em SVG gerado com a seed do post", null),
            new Aura("colo", "Colo", "Cuidador", List.of("#F2D0A4", "#E09F3E", "#A7C957", "#FFF3E0"), "blobs desfocados",
                    "radial-gradient(45% 45% at 25% 30%,#F2D0A4aa,#0000 70%),radial-gradient(40% 45% at 75% 70%,#A7C957aa,#0000 70%),radial-gradient(50% 40% at 70% 20%,#E09F3E99,#0000 70%),#3A2E22"),
            new Aura("asfalto", "Asfalto", "Rebelde", List.of("#14110E", "#FF2E88", "#3DDC6B", "#F7C948"), "meio-tom",
                    "radial-gradient(#FF2E8877 1.2px,#0000 1.7px) 0 0/7px 7px,radial-gradient(#3DDC6B55 1px,#0000 1.6px) 3.5px 3.5px/7px 7px,#14110E"));

    static final List<Item> MATERIALS = List.of(
            new Item("papel", "Papel", null, List.of()), new Item("cetim", "Cetim", null, List.of()),
            new Item("metal", "Metal", null, List.of()), new Item("vidro", "Vidro", null, List.of()));

    static final List<String> HYPE_STYLES = List.of("OFF", "SCANNER", "BRILHO");
    static final List<String> METAMORPHOSE_MODES = List.of("OFF", "PRISMA", "CONSTELACAO", "FIO_VIVO", "HOLOGRAFIA");
    static final List<String> VARIANTS = List.of("ORIGINAL", "SUAVE");
    static final List<String> FORMATS = List.of("IMAGEM_UNICA", "MOSAICO");
    static final List<Layout> LAYOUTS = List.of(new Layout("CLASSICO", "Clássico", false),
            new Layout("POLAROID", "Polaroid", false), new Layout("POSTER", "Pôster", true));
    static final List<Skin> SKINS = List.of(new Skin("PADRAO", "Padrão", "#211A12"),
            new Skin("MONO", "Mono", "#191714"), new Skin("LEVE", "Leve", "#2A2119"));
    static final List<Item> CONTAINER_COLORS = List.of(color("#2B2217", "Café"), color("#1E2A38", "Noite"),
            color("#F5EDE3", "Areia clara"), color("#FF6A2B", "Orange"));
    static final Rules RULES = new Rules(Contrast.AA_TEXT, 2048, 5, List.of("ALERT"));

    private final List<AuraPlus> auraPlus;
    private final String version;

    public BackgroundCatalog(@Value("${orange-social.backgrounds.asset-base-url}") String assetBaseUrl) {
        String base = assetBaseUrl.endsWith("/") ? assetBaseUrl.substring(0, assetBaseUrl.length() - 1) : assetBaseUrl;
        this.auraPlus = List.of(auraPlus(base, "brasa", "Brasa", "Herói"), auraPlus(base, "aurora", "Aurora", "Mago"));
        this.version = digest(String.join("|", COLORS.toString(), GRADIENTS.toString(), seasons().toString(),
                ANIMATIONS.toString(), AURAS.toString(), auraPlus.toString(), MATERIALS.toString(), HYPE_STYLES.toString(),
                METAMORPHOSE_MODES.toString(), LAYOUTS.toString(), SKINS.toString(), CONTAINER_COLORS.toString(), RULES.toString()));
    }

    public CatalogView view(LocalDate today) {
        return new CatalogView(version, SeasonalCalendar.activeOn(today).map(SeasonalCalendar.Season::id).orElse(null),
                COLORS, GRADIENTS, seasons(), ANIMATIONS, AURAS, auraPlus, MATERIALS, HYPE_STYLES, METAMORPHOSE_MODES,
                LAYOUTS, SKINS, CONTAINER_COLORS, RULES);
    }

    public String version() {
        return version;
    }

    // ------------------------------------------------------------ consultas usadas na validação e na leitura

    boolean hasColor(String hex) {
        return COLORS.stream().anyMatch(c -> c.id().equalsIgnoreCase(hex));
    }

    boolean hasGradient(String id) {
        return GRADIENTS.stream().anyMatch(g -> g.id().equals(id));
    }

    boolean hasAnimation(String id) {
        return ANIMATIONS.stream().anyMatch(a -> a.id().equals(id));
    }

    boolean hasAura(String id) {
        return AURAS.stream().anyMatch(a -> a.id().equals(id));
    }

    boolean hasMaterial(String id) {
        return MATERIALS.stream().anyMatch(m -> m.id().equals(id));
    }

    Map<String, AuraPlus> auraPlusById() {
        return auraPlus.stream().collect(Collectors.toMap(AuraPlus::id, Function.identity(), (a, b) -> a, LinkedHashMap::new));
    }

    Map<String, Layout> layoutsById() {
        return LAYOUTS.stream().collect(Collectors.toMap(Layout::id, Function.identity()));
    }

    Map<String, Skin> skinsById() {
        return SKINS.stream().collect(Collectors.toMap(Skin::id, Function.identity()));
    }

    private static List<SeasonView> seasons() {
        return SeasonalCalendar.SEASONS.stream()
                .map(s -> new SeasonView(s.id(), s.name(), s.window(), s.priority(), s.colors(), s.auto()))
                .toList();
    }

    private static Item color(String hex, String name) {
        return new Item(hex, name, hex, List.of(hex));
    }

    private static AuraPlus auraPlus(String base, String id, String name, String archetype) {
        String path = base + "/aura-plus/" + id;
        return new AuraPlus(id, name, archetype, path + "-poster.webp", path + "-hq.mp4", path + "-leve.mp4", 4);
    }

    private static String digest(String content) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(content.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash, 0, 8);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
