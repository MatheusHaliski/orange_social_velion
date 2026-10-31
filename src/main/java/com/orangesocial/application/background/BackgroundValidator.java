package com.orangesocial.application.background;

import com.orangesocial.application.post.PostExceptions;
import com.orangesocial.domain.model.FeedType;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Valida a configuração da moldura (campo {@code background} do post, RF28) e devolve a forma canônica que vai para o
 * banco. Mesmas regras do estúdio, aplicadas de novo no servidor porque o cliente não é confiável:
 * <ul>
 *   <li>só chaves conhecidas, só ids do catálogo — nada de URL nem CSS livre;</li>
 *   <li>uma fonte de arte por vez (cor, gradiente, cartela, aura, Aura Plus ou arte própria);</li>
 *   <li>layout com arte própria (Pôster) não combina com outra arte, material ou Metamorfose;</li>
 *   <li>alerta oficial não tem moldura; menor de 16 não usa arte própria;</li>
 *   <li>tinta × container ≥ 4,5:1 (WCAG AA).</li>
 * </ul>
 * Todos os problemas voltam juntos ({@code 422} com {@code errors}).
 */
@Component
public class BackgroundValidator {

    public record Context(FeedType feed, boolean protectedMinor) {
    }

    private static final Set<String> TOP = Set.of("v", "color", "gradientId", "seasonal", "animationId", "aura",
            "auraPlusId", "auraHypeStyle", "metamorphose", "materialId", "customArt", "layoutId", "skinId", "container");

    private final BackgroundCatalog catalog;

    public BackgroundValidator(BackgroundCatalog catalog) {
        this.catalog = catalog;
    }

    /** {@code null} = moldura padrão (sem arte). */
    public Map<String, Object> validate(Object raw, Context ctx) {
        if (raw == null) {
            return null;
        }
        if (ctx.feed() == FeedType.ALERT) {
            throw new PostExceptions.Invalid(List.of("Alertas oficiais não têm moldura: a faixa de alerta precisa ser reconhecida na hora."));
        }
        List<String> errors = new ArrayList<>();
        Map<String, Object> in = object(raw, "background", TOP, errors);
        if (in == null) {
            throw new PostExceptions.Invalid(errors);
        }
        if (String.valueOf(raw).length() > BackgroundCatalog.RULES.maxConfigBytes()) {
            errors.add("A configuração da moldura passa de " + BackgroundCatalog.RULES.maxConfigBytes() + " bytes.");
        }
        Object v = in.getOrDefault("v", 1);
        if (!(v instanceof Number n) || n.intValue() != 1) {
            errors.add("Versão da configuração da moldura não suportada (use v = 1).");
        }

        String color = string(in, "color", errors);
        if (color != null && !catalog.hasColor(color)) {
            errors.add("Cor da moldura fora do catálogo: " + color + ".");
        }
        String gradientId = string(in, "gradientId", errors);
        if (gradientId != null && !catalog.hasGradient(gradientId)) {
            errors.add("Gradiente desconhecido: " + gradientId + ".");
        }

        Map<String, Object> seasonalIn = object(in.get("seasonal"), "seasonal", Set.of("presetId", "auto"), errors);
        String seasonId = seasonalIn == null ? null : string(seasonalIn, "presetId", errors);
        boolean seasonAuto = seasonalIn != null && bool(seasonalIn, "auto", errors);
        if (seasonId != null && SeasonalCalendar.byId(seasonId).isEmpty()) {
            errors.add("Cartela sazonal desconhecida: " + seasonId + ".");
        }
        if (seasonId != null && seasonAuto) {
            errors.add("Cartela sazonal: escolha uma cartela ou o modo automático, não os dois.");
        }

        String animationId = stringOr(in, "animationId", "NONE", errors);
        if (!catalog.hasAnimation(animationId)) {
            errors.add("Animação desconhecida: " + animationId + ".");
        }

        Map<String, Object> auraIn = object(in.get("aura"), "aura", Set.of("presetId", "variantId", "format"), errors);
        Map<String, Object> aura = null;
        if (auraIn != null) {
            String presetId = string(auraIn, "presetId", errors);
            String variantId = stringOr(auraIn, "variantId", "ORIGINAL", errors);
            String format = stringOr(auraIn, "format", "IMAGEM_UNICA", errors);
            if (presetId == null || !catalog.hasAura(presetId)) {
                errors.add("Aura desconhecida: " + presetId + ".");
            }
            if (!BackgroundCatalog.VARIANTS.contains(variantId)) {
                errors.add("Variação de aura inválida: use " + String.join(", ", BackgroundCatalog.VARIANTS) + ".");
            }
            if (!BackgroundCatalog.FORMATS.contains(format)) {
                errors.add("Formato de aura inválido: use " + String.join(", ", BackgroundCatalog.FORMATS) + ".");
            }
            aura = ordered("presetId", presetId, "variantId", variantId, "format", format);
        }

        String auraPlusId = string(in, "auraPlusId", errors);
        if (auraPlusId != null && !catalog.auraPlusById().containsKey(auraPlusId)) {
            errors.add("Aura Plus desconhecida: " + auraPlusId + ".");
        }
        String hype = stringOr(in, "auraHypeStyle", "OFF", errors);
        if (!BackgroundCatalog.HYPE_STYLES.contains(hype)) {
            errors.add("Estilo de Aura Hype inválido: use " + String.join(", ", BackgroundCatalog.HYPE_STYLES) + ".");
        }

        Map<String, Object> metaIn = object(in.get("metamorphose"), "metamorphose", Set.of("mode", "presetId"), errors);
        String metaMode = metaIn == null ? "OFF" : stringOr(metaIn, "mode", "OFF", errors);
        if (!BackgroundCatalog.METAMORPHOSE_MODES.contains(metaMode)) {
            errors.add("Metamorfose inválida: use " + String.join(", ", BackgroundCatalog.METAMORPHOSE_MODES) + ".");
        }
        if (metaIn != null && metaIn.get("presetId") != null) {
            errors.add("Presets de marcas parceiras ainda não estão disponíveis (exigem selo de publicidade).");
        }

        String materialId = string(in, "materialId", errors);
        if (materialId != null && !catalog.hasMaterial(materialId)) {
            errors.add("Material desconhecido: " + materialId + ".");
        }

        Map<String, Object> customIn = object(in.get("customArt"), "customArt", Set.of("assetId", "origin"), errors);
        if (customIn != null) {
            if (ctx.protectedMinor()) {
                throw new PostExceptions.Forbidden("Para menores de 16 anos a moldura usa só artes do catálogo, sem envio nem IA (ECA Digital).");
            }
            errors.add("Arte própria (envio ou IA) ainda não está disponível: precisa de moderação e checagem de flashes (OS-70).");
        }

        String layoutId = stringOr(in, "layoutId", "CLASSICO", errors);
        BackgroundCatalog.Layout layout = catalog.layoutsById().get(layoutId);
        if (layout == null) {
            errors.add("Layout desconhecido: " + layoutId + ".");
        }
        String skinId = stringOr(in, "skinId", "PADRAO", errors);
        BackgroundCatalog.Skin skin = catalog.skinsById().get(skinId);
        if (skin == null) {
            errors.add("Skin desconhecida: " + skinId + ".");
        }

        Map<String, Object> containerIn = object(in.get("container"), "container", Set.of("color", "ink"), errors);
        String containerColor = containerIn == null ? null : string(containerIn, "color", errors);
        String ink = containerIn == null ? "AUTO" : stringOr(containerIn, "ink", "AUTO", errors);
        if (containerColor != null && !Contrast.isHex(containerColor)) {
            errors.add("Cor do container deve ser #RRGGBB.");
        }
        if (!"AUTO".equals(ink) && !Contrast.isHex(ink)) {
            errors.add("Cor dos textos deve ser AUTO ou #RRGGBB.");
        }

        int artSources = (color != null ? 1 : 0) + (gradientId != null ? 1 : 0) + (seasonId != null || seasonAuto ? 1 : 0)
                + (aura != null ? 1 : 0) + (auraPlusId != null ? 1 : 0) + (customIn != null ? 1 : 0);
        if (artSources > 1) {
            errors.add("Escolha uma única arte para a moldura: cor, gradiente, cartela, aura, Aura Plus ou arte própria.");
        }
        if (layout != null && layout.ownArt()
                && (artSources > 0 || materialId != null || !"OFF".equals(metaMode))) {
            errors.add("O layout " + layout.name() + " já traz arte própria: não combina com outra arte, material ou Metamorfose.");
        }

        if (skin != null && (containerColor == null || Contrast.isHex(containerColor)) && ("AUTO".equals(ink) || Contrast.isHex(ink))) {
            String bg = containerColor != null ? containerColor.toUpperCase() : skin.containerColor();
            String fg = "AUTO".equals(ink) ? Contrast.bestInk(bg) : ink;
            double ratio = Contrast.ratio(fg, bg);
            if (ratio < Contrast.AA_TEXT) {
                String suggestion = Contrast.bestInk(bg);
                errors.add("Texto com contraste " + Contrast.format(ratio) + " sobre o container (mínimo 4,5:1). Sugestão: tinta "
                        + suggestion + " (" + Contrast.format(Contrast.ratio(suggestion, bg)) + ").");
            }
        }

        if (!errors.isEmpty()) {
            throw new PostExceptions.Invalid(errors);
        }
        return ordered(
                "v", 1,
                "color", color == null ? null : color.toUpperCase(),
                "gradientId", gradientId,
                "seasonal", ordered("presetId", seasonId, "auto", seasonAuto),
                "animationId", animationId,
                "aura", aura,
                "auraPlusId", auraPlusId,
                "auraHypeStyle", hype,
                "metamorphose", ordered("mode", metaMode, "presetId", null),
                "materialId", materialId,
                "customArt", null,
                "layoutId", layoutId,
                "skinId", skinId,
                "container", ordered("color", containerColor == null ? null : containerColor.toUpperCase(),
                        "ink", "AUTO".equals(ink) ? "AUTO" : ink.toUpperCase()));
    }

    // ------------------------------------------------------------ leitura tipada com mensagens em pt-BR

    @SuppressWarnings("unchecked")
    private static Map<String, Object> object(Object value, String field, Set<String> keys, List<String> errors) {
        if (value == null) {
            return null;
        }
        if (!(value instanceof Map<?, ?> map)) {
            errors.add("\"" + field + "\" deve ser um objeto.");
            return null;
        }
        for (Object key : map.keySet()) {
            if (!keys.contains(String.valueOf(key))) {
                errors.add("Campo \"" + field + "." + key + "\" não existe na configuração da moldura.");
            }
        }
        return (Map<String, Object>) map;
    }

    private static String string(Map<String, Object> in, String key, List<String> errors) {
        Object value = in.get(key);
        if (value == null) {
            return null;
        }
        if (!(value instanceof String s) || s.isBlank() || s.length() > 64) {
            errors.add("\"" + key + "\" deve ser um texto curto.");
            return null;
        }
        return s;
    }

    private static String stringOr(Map<String, Object> in, String key, String fallback, List<String> errors) {
        String value = string(in, key, errors);
        return value == null ? fallback : value;
    }

    private static boolean bool(Map<String, Object> in, String key, List<String> errors) {
        Object value = in.get(key);
        if (value == null) {
            return false;
        }
        if (!(value instanceof Boolean b)) {
            errors.add("\"" + key + "\" deve ser verdadeiro ou falso.");
            return false;
        }
        return b;
    }

    private static Map<String, Object> ordered(Object... pairs) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) {
            out.put((String) pairs[i], pairs[i + 1]);
        }
        return out;
    }
}
