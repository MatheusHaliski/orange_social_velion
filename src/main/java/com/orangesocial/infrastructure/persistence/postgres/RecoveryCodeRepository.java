package com.orangesocial.infrastructure.persistence.postgres;

import com.orangesocial.domain.model.RecoveryCode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface RecoveryCodeRepository extends JpaRepository<RecoveryCode, Long> {

    List<RecoveryCode> findByUserIdAndUsedAtIsNull(Long userId);

    long countByUserIdAndUsedAtIsNull(Long userId);

    @Modifying
    @Query("delete from RecoveryCode r where r.userId = :userId")
    int deleteAllOf(Long userId);
}
