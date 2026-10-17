package com.orangesocial.infrastructure.persistence.postgres;

import com.orangesocial.domain.model.TermsAcceptance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TermsAcceptanceRepository extends JpaRepository<TermsAcceptance, Long> {

    Optional<TermsAcceptance> findFirstByUserIdAndDocumentOrderByAcceptedAtDesc(Long userId, String document);
}
