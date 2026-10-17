package com.orangesocial.infrastructure.persistence.postgres;

import com.orangesocial.domain.model.AccountStatus;
import com.orangesocial.domain.model.CommunityInterest;
import com.orangesocial.domain.model.GeoLocation;
import com.orangesocial.domain.model.UserCategoryEnum;
import com.orangesocial.domain.model.UserControlList;
import com.orangesocial.support.PolyglotContainers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Valida contra um PostGIS real: Flyway aplica V1__baseline.sql, Hibernate valida a
 * entidade contra a tabela, e os campos JSONB / GEOGRAPHY se comportam como esperado.
 */
@SpringBootTest
@ActiveProfiles("it")
@Import(PolyglotContainers.class)
class UserControlListRepositoryIT {

    @Autowired
    UserControlListRepository repository;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    TransactionTemplate tx;

    /** Containers são reutilizados entre execuções; cada teste parte de uma tabela vazia. */
    @BeforeEach
    void cleanTable() {
        jdbc.execute("TRUNCATE TABLE \"VSusercontrolist\" RESTART IDENTITY CASCADE");
    }

    @Test
    void flywayAppliedBaselineAndEntityValidates() {
        Integer applied = jdbc.queryForObject(
                "SELECT count(*) FROM flyway_schema_history WHERE success", Integer.class);
        assertThat(applied).isGreaterThanOrEqualTo(1);

        List<String> extensions = jdbc.queryForList(
                "SELECT extname FROM pg_extension WHERE extname IN ('postgis','pg_trgm','unaccent')", String.class);
        assertThat(extensions).containsExactlyInAnyOrder("postgis", "pg_trgm", "unaccent");
    }

    @Test
    void persistsAllNineteenFieldsIncludingJsonbAndGeneratedGeography() {
        UserControlList user = new UserControlList("Ana Ribeiro", "ana@example.com", "argon2-hash", UserCategoryEnum.VERDE);
        user.setRecoveryEmail("ana.backup@example.com");
        user.setCitizenship("BR");
        user.setCountryOfResidence("BR");
        user.setStateOfResidence("PR");
        user.setCityOfResidence("Curitiba");
        user.setAddress("Rua XV de Novembro, 100");
        user.setCellphoneNumber("+5541999990000");
        user.setListOfInterestsAndHobbies(List.of("LIFESTYLE_FOOTBALL", "LIFESTYLE_GAMES"));
        user.setListOfJobsInterests(List.of("JOB_ENGINEERING"));
        user.setUserDateOfBirth(java.time.LocalDate.of(1995, 5, 20));
        user.setGender("feminino");
        user.setPhotoObjectKey("users/1/avatar/abc.webp");
        user.setListOfCommunitiesOfInterest(List.of(new CommunityInterest("SPORTS_CLUB", "BR", "Curitiba")));
        user.setLastSavedLocation(new GeoLocation(-25.4284, -49.2733, Instant.parse("2026-10-17T12:00:00Z")));

        UserControlList saved = tx.execute(status -> repository.saveAndFlush(user));
        assertThat(saved.getId()).isNotNull();

        UserControlList reloaded = repository.findByEmail("ana@example.com").orElseThrow();
        assertThat(reloaded.getListOfInterestsAndHobbies()).containsExactly("LIFESTYLE_FOOTBALL", "LIFESTYLE_GAMES");
        assertThat(reloaded.getListOfCommunitiesOfInterest())
                .containsExactly(new CommunityInterest("SPORTS_CLUB", "BR", "Curitiba"));
        assertThat(reloaded.getLastSavedLocation().lat()).isEqualTo(-25.4284);
        assertThat(reloaded.getAccountStatus()).isEqualTo(AccountStatus.PENDING_VERIFICATION);

        // Coluna GEOGRAPHY gerada a partir do JSON e índice GIST utilizáveis pelo PostGIS
        Double metersToCenter = jdbc.queryForObject("""
                SELECT ST_Distance(last_saved_point, ST_SetSRID(ST_MakePoint(-49.2733, -25.4284), 4326)::geography)
                FROM "VSusercontrolist" WHERE id = ?
                """, Double.class, saved.getId());
        assertThat(metersToCenter).isLessThan(1.0);

        Integer nearby = jdbc.queryForObject("""
                SELECT count(*) FROM "VSusercontrolist"
                WHERE ST_DWithin(last_saved_point, ST_SetSRID(ST_MakePoint(-49.27, -25.43), 4326)::geography, 5000)
                """, Integer.class);
        assertThat(nearby).isEqualTo(1);
    }

    @Test
    void nameAxisUsesTrigramAndUnaccent() {
        tx.executeWithoutResult(status -> repository.saveAndFlush(
                new UserControlList("José Antônio", "jose@example.com", "hash", UserCategoryEnum.AMARELO)));

        Integer matches = jdbc.queryForObject("""
                SELECT count(*) FROM "VSusercontrolist"
                WHERE lower(f_unaccent(name)) % lower(f_unaccent('jose antonio'))
                """, Integer.class);
        assertThat(matches).isEqualTo(1);

        assertThat(repository.findByNameContainingIgnoreCaseAndAccountStatus(
                "antônio", AccountStatus.PENDING_VERIFICATION, PageRequest.of(0, 10)).getTotalElements())
                .isEqualTo(1);
    }

    @Test
    void checkConstraintsRejectInvalidUserType() {
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO "VSusercontrolist" (name, password_hash, email, user_type)
                VALUES ('x', 'h', 'bad@example.com', 'ROXO')
                """)).hasMessageContaining("chk_vsusercontrolist_user_type");
    }
}
