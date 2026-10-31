package com.orangesocial.application.background;

import com.orangesocial.domain.model.FeedType;
import com.orangesocial.domain.model.MediaType;
import com.orangesocial.domain.model.UserCategoryEnum;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Leitura da moldura (RF28): transforma a configuração salva no post no que o card precisa para desenhar — arte
 * escolhida, cartela do dia no modo automático, mídias da Aura Plus e tinta do container já calculada.
 * Também sugere a "direção recomendada" do estúdio.
 */
@Service
public class BackgroundService {

    public static final ZoneId SAO_PAULO = ZoneId.of("America/Sao_Paulo");

    public record BackgroundView(Map<String, Object> config, String artKind, String artId, List<String> palette,
                                 String css, AuraPlusMedia auraPlus, ContainerView container) {
    }

    /** Vídeo em loop (AV1 com H.264 de reserva) + pôster; toca no máximo {@code maxPlaySeconds} (WCAG 2.2.2). */
    public record AuraPlusMedia(String poster, String av1, String h264, int loopSeconds, int maxPlaySeconds) {
    }

    public record ContainerView(String color, String ink, String contrast) {
    }

    public record Recommendation(String auraId, String materialId, String seasonId, String reason) {
    }

    private static final Map<UserCategoryEnum, List<String[]>> BY_CATEGORY = Map.of(
            UserCategoryEnum.VERDE, List.of(new String[]{"eclipse", "vidro"}, new String[]{"colo", "papel"}, new String[]{"mare", "cetim"}),
            UserCategoryEnum.AMARELO, List.of(new String[]{"ouro-velho", "metal"}, new String[]{"entardecer", "papel"}),
            UserCategoryEnum.AZUL, List.of(new String[]{"asfalto", "vidro"}, new String[]{"eclipse", "metal"}),
            UserCategoryEnum.LARANJA, List.of(new String[]{"varanda", "papel"}, new String[]{"confete", "cetim"}),
            UserCategoryEnum.VERMELHO, List.of(new String[]{"ouro-velho", "metal"}, new String[]{"mare", "vidro"}),
            UserCategoryEnum.PRETO, List.of(new String[]{"eclipse", "cetim"}, new String[]{"confete", "vidro"}));

    private final BackgroundCatalog catalog;
    private final Clock clock;

    public BackgroundService(BackgroundCatalog catalog, Clock clock) {
        this.catalog = catalog;
        this.clock = clock;
    }

    /** Data de referência das cartelas: sempre o dia em São Paulo (fuso fixo UTC−3 desde 2019). */
    public LocalDate today() {
        return LocalDate.now(clock.withZone(SAO_PAULO));
    }

    public BackgroundCatalog.CatalogView catalog() {
        return catalog.view(today());
    }

    /** {@code null} quando o post usa a moldura padrão. */
    public BackgroundView resolve(Map<String, Object> config) {
        if (config == null) {
            return null;
        }
        String layoutId = (String) config.get("layoutId");
        String kind;
        String id = null;
        List<String> palette = List.of();
        String css = null;
        AuraPlusMedia media = null;
        Map<?, ?> seasonal = (Map<?, ?>) config.get("seasonal");
        Map<?, ?> aura = (Map<?, ?>) config.get("aura");
        if (catalog.layoutsById().get(layoutId) != null && catalog.layoutsById().get(layoutId).ownArt()) {
            kind = "LAYOUT";
            id = layoutId;
        } else if (config.get("auraPlusId") instanceof String plusId) {
            BackgroundCatalog.AuraPlus plus = catalog.auraPlusById().get(plusId);
            kind = "AURA_PLUS";
            id = plusId;
            media = new AuraPlusMedia(plus.poster(), plus.av1(), plus.h264(), plus.loopSeconds(),
                    BackgroundCatalog.RULES.maxAnimationSeconds());
        } else if (aura != null) {
            kind = "AURA";
            id = (String) aura.get("presetId");
            BackgroundCatalog.Aura a = BackgroundCatalog.AURAS.stream().filter(x -> x.id().equals(aura.get("presetId"))).findFirst().orElseThrow();
            palette = a.palette();
            css = a.css();
        } else if (seasonal != null && (Boolean.TRUE.equals(seasonal.get("auto")) || seasonal.get("presetId") != null)) {
            Optional<SeasonalCalendar.Season> season = Boolean.TRUE.equals(seasonal.get("auto"))
                    ? SeasonalCalendar.activeOn(today())
                    : SeasonalCalendar.byId((String) seasonal.get("presetId"));
            kind = "SEASONAL";
            id = season.map(SeasonalCalendar.Season::id).orElse(null);
            palette = season.map(SeasonalCalendar.Season::colors).orElse(List.of());
            css = palette.isEmpty() ? null : seasonGradient(palette);
        } else if (config.get("gradientId") instanceof String gradientId) {
            BackgroundCatalog.Item g = BackgroundCatalog.GRADIENTS.stream().filter(x -> x.id().equals(gradientId)).findFirst().orElseThrow();
            kind = "GRADIENT";
            id = gradientId;
            palette = g.palette();
            css = g.css();
        } else if (config.get("color") instanceof String color) {
            kind = "COLOR";
            id = color;
            palette = List.of(color);
            css = color;
        } else {
            kind = "NONE";
        }
        return new BackgroundView(config, kind, id, palette, css, media, container(config));
    }

    /** Direção recomendada: auras que combinam com a categoria do autor, mais a cartela do dia. */
    public List<Recommendation> recommend(UserCategoryEnum category, FeedType feed, MediaType media) {
        if (feed == FeedType.ALERT) {
            return List.of();
        }
        List<Recommendation> out = new ArrayList<>();
        for (String[] pair : BY_CATEGORY.get(category)) {
            // mídia pesada (foto/vídeo) já chama atenção: sugere a aura sem material por cima
            String material = media == MediaType.IMAGE || media == MediaType.VIDEO ? null : pair[1];
            out.add(new Recommendation(pair[0], material, null,
                    "Combina com " + category.getLabel() + (material == null ? " e deixa a mídia em destaque" : " e post de texto")));
        }
        SeasonalCalendar.activeOn(today()).ifPresent(s ->
                out.add(new Recommendation(null, null, s.id(), "Cartela da época: " + s.name())));
        return out;
    }

    private ContainerView container(Map<String, Object> config) {
        Map<?, ?> c = (Map<?, ?>) config.get("container");
        BackgroundCatalog.Skin skin = catalog.skinsById().get((String) config.get("skinId"));
        String bg = c != null && c.get("color") instanceof String color ? color : skin.containerColor();
        String ink = c != null && c.get("ink") instanceof String i && !"AUTO".equals(i) ? i : Contrast.bestInk(bg);
        return new ContainerView(bg, ink, Contrast.format(Contrast.ratio(ink, bg)));
    }

    private static String seasonGradient(List<String> colors) {
        StringBuilder css = new StringBuilder("linear-gradient(135deg");
        for (int i = 0; i < colors.size(); i++) {
            css.append(',').append(colors.get(i)).append(' ').append(i * 100 / (colors.size() - 1)).append('%');
        }
        return css.append(')').toString();
    }
}
