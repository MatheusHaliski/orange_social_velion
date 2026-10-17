package com.orangesocial.infrastructure.persistence.cassandra;

import org.springframework.data.cassandra.core.cql.Ordering;
import org.springframework.data.cassandra.core.cql.PrimaryKeyType;
import org.springframework.data.cassandra.core.mapping.PrimaryKeyClass;
import org.springframework.data.cassandra.core.mapping.PrimaryKeyColumn;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Chave de {@code post_timeline}: partição (owner_user_id, feed_type, day_bucket)
 * e clustering por post_id (timeuuid) decrescente.
 */
@PrimaryKeyClass
public record PostTimelineKey(

        @PrimaryKeyColumn(name = "owner_user_id", ordinal = 0, type = PrimaryKeyType.PARTITIONED)
        Long ownerUserId,

        @PrimaryKeyColumn(name = "feed_type", ordinal = 1, type = PrimaryKeyType.PARTITIONED)
        String feedType,

        @PrimaryKeyColumn(name = "day_bucket", ordinal = 2, type = PrimaryKeyType.PARTITIONED)
        LocalDate dayBucket,

        @PrimaryKeyColumn(name = "post_id", ordinal = 3, type = PrimaryKeyType.CLUSTERED,
                ordering = Ordering.DESCENDING)
        UUID postId) {
}
