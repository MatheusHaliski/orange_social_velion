package com.orangesocial.domain.model;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DomainModelTest {

    @Test
    void categoryColorsMatchSpec() {
        assertThat(UserCategoryEnum.VERDE.getHexColor()).isEqualTo("#3DDC6B");
        assertThat(UserCategoryEnum.AMARELO.getHexColor()).isEqualTo("#F7C948");
        assertThat(UserCategoryEnum.AZUL.getHexColor()).isEqualTo("#4A93FF");
        assertThat(UserCategoryEnum.LARANJA.getHexColor()).isEqualTo("#FF9F1C");
        assertThat(UserCategoryEnum.VERMELHO.getHexColor()).isEqualTo("#FF4D4D");
        assertThat(UserCategoryEnum.PRETO.getHexColor()).isEqualTo("#0C0A07");
        assertThat(UserCategoryEnum.fromCode('e')).isEqualTo(UserCategoryEnum.VERMELHO);
    }

    @Test
    void lgpdDeletionIsTerminalAndErasesPersonalData() {
        UserControlList user = new UserControlList("Ana", "ana@example.com", "hash", UserCategoryEnum.VERDE);
        user.setSexualPreference("x");
        user.setLastSavedLocation(new GeoLocation(-25.42, -49.27, Instant.now()));
        user.activate();

        user.anonymizeForLgpdDeletion("anon-hash");

        assertThat(user.getAccountStatus()).isEqualTo(AccountStatus.ANONYMOUS_LGPD_DELETED);
        assertThat(user.getSexualPreference()).isNull();
        assertThat(user.getLastSavedLocation()).isNull();
        assertThat(user.getEmail()).doesNotContain("ana");
        assertThat(user.getDeletedAt()).isNotNull();
        assertThatThrownBy(user::activate).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void pendingUserCannotBeSuspended() {
        UserControlList user = new UserControlList("Ana", "ana@example.com", "hash", UserCategoryEnum.VERDE);
        assertThatThrownBy(user::suspend).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void geoLocationRejectsInvalidCoordinates() {
        assertThatThrownBy(() -> new GeoLocation(91, 0, Instant.now()))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
