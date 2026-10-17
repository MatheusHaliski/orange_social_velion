package com.orangesocial.infrastructure.cache.redis;

/**
 * Fórmula do Trending Score (ADR-03 em docs/PESQUISA_TECNOLOGIAS.md).
 *
 * <p>Visualizações são o motor principal, mas em escala logarítmica para que
 * engajamento ativo (compartilhar, comentar) ainda pese; o denominador aplica
 * decaimento temporal no estilo Hacker News, de modo que um post novo em
 * crescimento vença um post antigo com muitas visualizações acumuladas.
 *
 * <pre>
 * engagement = log10(1 + viewsÚnicas) * W_VIEWS
 *            + likes * W_LIKE + comments * W_COMMENT + shares * W_SHARE + saves * W_SAVE
 * score      = engagement / (horasDesdePublicacao + 2) ^ GRAVITY
 * </pre>
 *
 * <p>Na operação, cada interação acumula o seu peso bruto no ZSET via
 * {@link #incrementFor(InteractionType)} ({@code ZINCRBY}); um job periódico
 * recalcula o score completo com {@link #score} para aplicar o decaimento.
 * Views únicas são contadas por (usuário, post) com HyperLogLog antes de chegar aqui.
 */
public final class TrendingScoreCalculator {

    static final double VIEW_WEIGHT = 10.0;     // multiplica log10(1 + views)
    static final double LIKE_WEIGHT = 0.8;
    static final double COMMENT_WEIGHT = 1.2;
    static final double SHARE_WEIGHT = 1.5;
    static final double SAVE_WEIGHT = 1.0;
    static final double GRAVITY = 1.6;          // entre 1,5 e 1,8; maior = decai mais rápido

    private TrendingScoreCalculator() {
    }

    public static double score(long uniqueViews, long likes, long comments, long shares, long saves,
                               double hoursSincePublish) {
        if (hoursSincePublish < 0) {
            throw new IllegalArgumentException("hoursSincePublish não pode ser negativo");
        }
        double engagement = engagement(uniqueViews, likes, comments, shares, saves);
        return engagement / Math.pow(hoursSincePublish + 2.0, GRAVITY);
    }

    /** Numerador da fórmula, sem decaimento. */
    public static double engagement(long uniqueViews, long likes, long comments, long shares, long saves) {
        return Math.log10(1 + Math.max(0, uniqueViews)) * VIEW_WEIGHT
                + likes * LIKE_WEIGHT
                + comments * COMMENT_WEIGHT
                + shares * SHARE_WEIGHT
                + saves * SAVE_WEIGHT;
    }

    /**
     * Incremento bruto aplicado no ZSET a cada interação. Para views o valor é
     * aproximado (derivada de log10 em 1 view); o recálculo periódico corrige.
     */
    public static double incrementFor(InteractionType interaction) {
        return switch (interaction) {
            case VIEW -> VIEW_WEIGHT / Math.log(10); // ≈ 4,34: d/dx[10·log10(1+x)] em x=0
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
