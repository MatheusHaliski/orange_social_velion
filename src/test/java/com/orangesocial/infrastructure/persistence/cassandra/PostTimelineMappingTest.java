package com.orangesocial.infrastructure.persistence.cassandra;

import org.junit.jupiter.api.Test;
import org.springframework.data.cassandra.core.mapping.CassandraMappingContext;
import org.springframework.data.cassandra.core.mapping.CassandraPersistentEntity;
import org.springframework.data.cassandra.core.mapping.CassandraPersistentProperty;

import static org.assertj.core.api.Assertions.assertThat;

class PostTimelineMappingTest {

    @Test
    void primaryKeyMatchesCqlSchema() {
        CassandraMappingContext context = new CassandraMappingContext();
        CassandraPersistentEntity<?> entity = context.getRequiredPersistentEntity(PostTimelineEntity.class);
        CassandraPersistentEntity<?> key = context.getRequiredPersistentEntity(PostTimelineKey.class);

        assertThat(entity.getTableName().asInternal()).isEqualTo("post_timeline");
        assertThat(key.isCompositePrimaryKey()).isTrue();
        assertThat(key.getRequiredPersistentProperty("ownerUserId").isPartitionKeyColumn()).isTrue();
        assertThat(key.getRequiredPersistentProperty("feedType").isPartitionKeyColumn()).isTrue();
        assertThat(key.getRequiredPersistentProperty("dayBucket").isPartitionKeyColumn()).isTrue();
        CassandraPersistentProperty postId = key.getRequiredPersistentProperty("postId");
        assertThat(postId.isClusterKeyColumn()).isTrue();
        assertThat(postId.getRequiredColumnName().asInternal()).isEqualTo("post_id");
    }
}
