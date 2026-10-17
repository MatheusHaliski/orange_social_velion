package com.orangesocial.infrastructure.cache.redis;

import com.orangesocial.domain.model.FeedType;
import com.orangesocial.domain.model.UserCategoryEnum;
import com.orangesocial.support.PolyglotContainers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/** Ranking ZSET contra um Valkey real. */
@SpringBootTest
@ActiveProfiles("it")
@Import(PolyglotContainers.class)
class TrendingScoreRepositoryIT {

    @Autowired
    TrendingScoreRepository trending;

    @Autowired
    StringRedisTemplate redis;

    @BeforeEach
    void clean() {
        redis.getConnectionFactory().getConnection().serverCommands().flushDb();
    }

    @Test
    void ranksPostsGloballyAndPerCategory() {
        trending.setScore(FeedType.AUDIO, UserCategoryEnum.AMARELO, "podcast-1", 50);
        trending.setScore(FeedType.AUDIO, UserCategoryEnum.VERDE, "audio-2", 80);
        trending.increment(FeedType.AUDIO, UserCategoryEnum.AMARELO, "podcast-1",
                TrendingScoreCalculator.incrementFor(TrendingScoreCalculator.InteractionType.SHARE));

        assertThat(trending.topPostIds(FeedType.AUDIO, 10)).containsExactly("audio-2", "podcast-1");
        assertThat(trending.topPostIds(FeedType.AUDIO, UserCategoryEnum.AMARELO, 10)).containsExactly("podcast-1");
        assertThat(trending.getScore(FeedType.AUDIO, "podcast-1")).hasValueSatisfying(
                s -> assertThat(s).isCloseTo(51.5, within(1e-6)));
        assertThat(trending.getRank(FeedType.AUDIO, "audio-2")).hasValue(0L);

        Long ttl = redis.getExpire("trending:audio");
        assertThat(ttl).isPositive().isLessThanOrEqualTo(TrendingScoreRepository.KEY_TTL.toSeconds());
    }

    @Test
    void removeClearsEveryRankingOfTheFeed() {
        trending.setScore(FeedType.POST, UserCategoryEnum.AZUL, "post-9", 10);
        trending.remove(FeedType.POST, "post-9");

        assertThat(trending.topPostIds(FeedType.POST, 10)).isEmpty();
        assertThat(trending.topPostIds(FeedType.POST, UserCategoryEnum.AZUL, 10)).isEmpty();
    }
}
