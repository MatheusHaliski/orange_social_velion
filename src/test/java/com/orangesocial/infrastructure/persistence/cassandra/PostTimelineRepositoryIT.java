package com.orangesocial.infrastructure.persistence.cassandra;

import com.datastax.oss.driver.api.core.uuid.Uuids;
import com.orangesocial.support.PolyglotContainers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Slice;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

import static org.assertj.core.api.Assertions.assertThat;

/** Timeline contra um Cassandra 5 real com o schema.cql aplicado. */
@SpringBootTest
@ActiveProfiles("it")
@Import(PolyglotContainers.class)
class PostTimelineRepositoryIT {

    @Autowired
    PostTimelineRepository timeline;

    @Test
    void writesAndReadsPartitionNewestFirst() {
        // Partição própria por execução: containers reutilizados preservam dados entre rodadas
        long owner = ThreadLocalRandom.current().nextLong(1, Long.MAX_VALUE);
        LocalDate today = LocalDate.now(ZoneOffset.UTC);

        UUID older = Uuids.timeBased();
        UUID newer = Uuids.timeBased();

        timeline.save(entry(owner, today, older, "Episódio 11"));
        timeline.save(entry(owner, today, newer, "Episódio 12"));

        Slice<PostTimelineEntity> page = timeline.findTimeline(owner, "AUDIO", today, PageRequest.of(0, 10));

        assertThat(page.getContent()).extracting(PostTimelineEntity::getTitle)
                .containsExactly("Episódio 12", "Episódio 11");
        assertThat(page.getContent().get(0).getAuthorUserType()).isEqualTo("AMARELO");
        assertThat(timeline.findById(page.getContent().get(0).getKey())).isPresent();
    }

    private static PostTimelineEntity entry(long owner, LocalDate day, UUID postId, String title) {
        PostTimelineEntity e = new PostTimelineEntity(
                new PostTimelineKey(owner, "AUDIO", day, postId), 7L, "AMARELO", "AUDIO", title, Instant.now());
        e.setDurationSeconds(2538);
        e.setCountry("BR");
        e.setCity("Curitiba");
        return e;
    }
}
