package com.orangesocial.infrastructure.persistence.postgres;

import com.orangesocial.domain.model.UserMfa;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserMfaRepository extends JpaRepository<UserMfa, Long> {
}
