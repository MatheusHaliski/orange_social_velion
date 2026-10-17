package com.orangesocial.infrastructure.cache.redis;

import com.orangesocial.domain.model.FeedType;
import com.orangesocial.domain.model.UserCategoryEnum;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TrendingScoreTest {

    @Test
    void newerPostWinsOverOlderWithSameEngagement() {
        double fresh = TrendingScoreCalculator.score(100, 10, 2, 1, 0, 0);
        double old = TrendingScoreCalculator.score(100, 10, 2, 1, 0, 24);
        assertThat(fresh).isGreaterThan(old);
    }

    @Test
    void viewsCountLogarithmicallySoStaleViralPostsDecay() {
        // 100k views acumuladas em 48h perdem para 5k views em 2h
        double stale = TrendingScoreCalculator.score(100_000, 0, 0, 0, 0, 48);
        double rising = TrendingScoreCalculator.score(5_000, 0, 0, 0, 0, 2);
        assertThat(rising).isGreaterThan(stale);

        // 10x mais views não vale 10x mais engajamento
        double e1 = TrendingScoreCalculator.engagement(1_000, 0, 0, 0, 0);
        double e10 = TrendingScoreCalculator.engagement(10_000, 0, 0, 0, 0);
        assertThat(e10 / e1).isLessThan(2.0);
    }

    @Test
    void incrementUpdatesGlobalAndCategoryRankings() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        @SuppressWarnings("unchecked")
        ZSetOperations<String, String> zset = mock(ZSetOperations.class);
        when(redis.opsForZSet()).thenReturn(zset);
        when(zset.incrementScore(anyString(), anyString(), anyDouble())).thenReturn(42.0);

        double score = new TrendingScoreRepository(redis)
                .increment(FeedType.AUDIO, UserCategoryEnum.AMARELO, "post-1", 1.5);

        assertThat(score).isEqualTo(42.0);
        verify(zset).incrementScore("trending:audio", "post-1", 1.5);
        verify(zset).incrementScore("trending:audio:amarelo", "post-1", 1.5);
        verify(redis).expire("trending:audio", TrendingScoreRepository.KEY_TTL);
    }
}
