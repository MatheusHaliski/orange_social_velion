package com.orangesocial.infrastructure.persistence.cassandra;

import org.springframework.data.cassandra.repository.CassandraRepository;
import org.springframework.data.cassandra.repository.Query;
import org.springframework.data.domain.Slice;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;

public interface PostTimelineRepository extends CassandraRepository<PostTimelineEntity, PostTimelineKey> {

    /** Lê uma partição (dono + feed + dia), já ordenada do post mais novo para o mais antigo. */
    @Query("SELECT * FROM post_timeline WHERE owner_user_id = ?0 AND feed_type = ?1 AND day_bucket = ?2")
    Slice<PostTimelineEntity> findTimeline(Long ownerUserId, String feedType, LocalDate dayBucket, Pageable pageable);
}
