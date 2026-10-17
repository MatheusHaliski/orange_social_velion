package com.orangesocial.infrastructure.persistence.postgres;

import com.orangesocial.domain.model.AccountStatus;
import com.orangesocial.domain.model.UserCategoryEnum;
import com.orangesocial.domain.model.UserControlList;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserControlListRepository extends JpaRepository<UserControlList, Long> {

    Optional<UserControlList> findByEmail(String email);

    /** Job diário (RF23): contas cujo prazo de 30 dias para reativar terminou. */
    java.util.List<UserControlList> findByAccountStatusAndDeletionScheduledForBefore(AccountStatus status, java.time.Instant now);

    boolean existsByEmail(String email);

    boolean existsByHandle(String handle);

    /** Profile Feed: filtros Categoria + País + Cidade. */
    Page<UserControlList> findByUserTypeAndCountryOfResidenceAndCityOfResidenceAndAccountStatus(
            UserCategoryEnum userType, String country, String city, AccountStatus status, Pageable pageable);

    /** Profile Feed: filtro por Nome. */
    Page<UserControlList> findByNameContainingIgnoreCaseAndAccountStatus(
            String name, AccountStatus status, Pageable pageable);
}
