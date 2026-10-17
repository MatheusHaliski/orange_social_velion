package com.orangesocial.infrastructure.cache.redis;

import com.orangesocial.domain.model.FeedType;
import com.orangesocial.domain.model.UserCategoryEnum;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.stereotype.Repository;

import java.time.Duration;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/**
 * Ranking em tempo real com ZSET (Valkey, protocolo Redis).
 *
 * <ul>
 *   <li>{@code trending:{feed}} — ranking global do feed</li>
 *   <li>{@code trending:{feed}:{categoria}} — ranking filtrado por cor do autor</li>
 * </ul>
 * Membro = postId, score = Trending Score.
 */
@Repository
public class TrendingScoreRepository {

    private static final String PREFIX = "trending:";
    static final Duration KEY_TTL = Duration.ofHours(48);

    private final StringRedisTemplate redis;

    public TrendingScoreRepository(StringRedisTemplate redis) {
        this.redis = redis;
    }

    static String key(FeedType feed) {
        return PREFIX + feed.name().toLowerCase();
    }

    static String key(FeedType feed, UserCategoryEnum category) {
        return key(feed) + ":" + category.name().toLowerCase();
    }

    /** Define o score absoluto (ex.: após recálculo periódico). */
    public void setScore(FeedType feed, UserCategoryEnum authorCategory, String postId, double score) {
        zset().add(key(feed), postId, score);
        zset().add(key(feed, authorCategory), postId, score);
        touch(feed, authorCategory);
    }

    /** Soma o peso de uma interação (ZINCRBY) e devolve o novo score global. */
    public double increment(FeedType feed, UserCategoryEnum authorCategory, String postId, double delta) {
        Double updated = zset().incrementScore(key(feed), postId, delta);
        zset().incrementScore(key(feed, authorCategory), postId, delta);
        touch(feed, authorCategory);
        return updated == null ? 0.0 : updated;
    }

    public Optional<Double> getScore(FeedType feed, String postId) {
        return Optional.ofNullable(zset().score(key(feed), postId));
    }

    /** Posição (0 = topo) no ranking global do feed. */
    public Optional<Long> getRank(FeedType feed, String postId) {
        return Optional.ofNullable(zset().reverseRank(key(feed), postId));
    }

    public List<String> topPostIds(FeedType feed, int limit) {
        return toList(zset().reverseRange(key(feed), 0, limit - 1L));
    }

    public List<String> topPostIds(FeedType feed, UserCategoryEnum category, int limit) {
        return toList(zset().reverseRange(key(feed, category), 0, limit - 1L));
    }

    /** Remove o post de todos os rankings do feed (post removido/arquivado ou eliminação LGPD). */
    public void remove(FeedType feed, String postId) {
        zset().remove(key(feed), postId);
        for (UserCategoryEnum category : UserCategoryEnum.values()) {
            zset().remove(key(feed, category), postId);
        }
    }

    private void touch(FeedType feed, UserCategoryEnum category) {
        redis.expire(key(feed), KEY_TTL);
        redis.expire(key(feed, category), KEY_TTL);
    }

    private ZSetOperations<String, String> zset() {
        return redis.opsForZSet();
    }

    private static List<String> toList(Set<String> ids) {
        return ids == null ? List.of() : ids.stream().filter(Objects::nonNull).toList();
    }
}
