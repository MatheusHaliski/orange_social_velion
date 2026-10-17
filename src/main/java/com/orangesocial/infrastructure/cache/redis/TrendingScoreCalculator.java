package com.orangesocial.infrastructure.cache.redis;

/**
 * Fórmula do Trending Score (Orange Social: visualizações como motor principal,
 * com frescor para que posts novos possam competir com posts antigos).
 *
 * <pre>
 * score = views * 1.0 + likes * 0.8 + comments * 1.2 + shares * 1.5 + saves * 1.0
 *       + 100 / (horasDesdePublicacao + 1)
 * </pre>
 */
public final class TrendingScoreCalculator {

    static final double VIEW_WEIGHT = 1.0;
    static final double LIKE_WEIGHT = 0.8;
    static final double COMMENT_WEIGHT = 1.2;
    static final double SHARE_WEIGHT = 1.5;
    static final double SAVE_WEIGHT = 1.0;
    static final double FRESHNESS_FACTOR = 100.0;

    private TrendingScoreCalculator() {
    }

    public static double score(long views, long likes, long comments, long shares, long saves, double hoursSincePublish) {
        if (hoursSincePublish < 0) {
            throw new IllegalArgumentException("hoursSincePublish não pode ser negativo");
        }
        return views * VIEW_WEIGHT
                + likes * LIKE_WEIGHT
                + comments * COMMENT_WEIGHT
                + shares * SHARE_WEIGHT
                + saves * SAVE_WEIGHT
                + FRESHNESS_FACTOR / (hoursSincePublish + 1);
    }

    /** Incremento aplicado no ZSET a cada interação, sem recalcular o score inteiro. */
    public static double incrementFor(InteractionType interaction) {
        return switch (interaction) {
            case VIEW -> VIEW_WEIGHT;
            case LIKE -> LIKE_WEIGHT;
            case COMMENT -> COMMENT_WEIGHT;
            case SHARE -> SHARE_WEIGHT;
            case SAVE -> SAVE_WEIGHT;
        };
    }

    public enum InteractionType {
        VIEW, LIKE, COMMENT, SHARE, SAVE
    }
}
