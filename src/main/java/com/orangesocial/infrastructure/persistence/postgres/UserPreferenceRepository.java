package com.orangesocial.infrastructure.persistence.postgres;

import com.orangesocial.domain.model.UserPreference;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserPreferenceRepository extends JpaRepository<UserPreference, Long> {
}
