package com.orangesocial.api;

import com.orangesocial.domain.model.GeoLocation;
import com.orangesocial.domain.model.UserCategoryEnum;
import com.orangesocial.domain.model.UserControlList;
import com.orangesocial.infrastructure.persistence.postgres.UserControlListRepository;
import com.orangesocial.support.ApiClient;
import com.orangesocial.support.CapturingNotifier;
import com.orangesocial.support.PolyglotContainers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Consentimentos (RF3 · OS-40, OS-41): seis chaves desligadas por padrão, histórico append-only, repetir o valor não
 * grava, revogação com efeito imediato (orientação sexual e última localização apagadas) e trava por idade
 * (menor de 16: ECA Digital; menor de 18: dado sensível e biometria, LGPD Art. 14).
 */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@ActiveProfiles("it")
@Import({PolyglotContainers.class, CapturingNotifier.class})
class ConsentApiIT {

    static final String PASSWORD = "uma frase longa de teste";
    static final List<String> PURPOSES = List.of("LOCATION_TRACKING", "PERSONALIZED_FEED", "SENSITIVE_PROFILE_DATA",
            "FACIAL_RECOGNITION", "MARKETING", "THIRD_PARTY_SHARING");

    @LocalServerPort
    int port;

    @Autowired
    UserControlListRepository users;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    TransactionTemplate tx;

    @Autowired
    PasswordEncoder passwords;

    @Autowired
    StringRedisTemplate redis;

    final Map<Long, ApiClient> browsers = new HashMap<>();
    UserControlList ana;
    UserControlList teen;
    UserControlList older;

    @BeforeEach
    void seed() {
        jdbc.execute("TRUNCATE TABLE \"VSusercontrolist\" RESTART IDENTITY CASCADE");
        redis.getRequiredConnectionFactory().getConnection().serverCommands().flushDb();
        browsers.clear();
        ana = save(active("Ana Ribeiro", "ana@example.com", LocalDate.of(1994, 5, 2)));
        teen = save(active("Bia Souza", "bia@example.com", LocalDate.now().minusYears(14)));
        older = save(active("Caio Lima", "caio@example.com", LocalDate.now().minusYears(17)));
    }

    @Test
    void privacyByDefaultAndRevokingSensitiveDataErasesItAtOnce() {
        ResponseEntity<Map> list = send(HttpMethod.GET, "/api/v1/me/consents", ana, null);
        assertThat(list.getStatusCode().value()).isEqualTo(200);
        List<Map<String, Object>> rows = items(list.getBody());
        assertThat(rows).extracting(c -> c.get("purpose")).containsExactlyElementsOf(PURPOSES);
        Map<String, Map<String, Object>> byPurpose = byPurpose(list.getBody());
        assertThat(byPurpose.values()).allSatisfy(c -> {
            assertThat(c).containsOnlyKeys("purpose", "label", "description", "legalBasis", "sensitive", "granted",
                    "updatedAt", "lockedForMinor");
            assertThat(c.get("granted")).isEqualTo(false);
            assertThat(c.get("updatedAt")).isNull();   // conta sem evento: vale o padrão, desligado
            assertThat(c.get("lockedForMinor")).isEqualTo(false);
            assertThat((String) c.get("label")).isNotBlank();
            assertThat((String) c.get("description")).isNotBlank();
        });
        assertThat(byPurpose.entrySet().stream().filter(e -> (Boolean) e.getValue().get("sensitive"))
                .map(Map.Entry::getKey)).containsExactlyInAnyOrder("SENSITIVE_PROFILE_DATA", "FACIAL_RECOGNITION");
        assertThat(byPurpose.get("SENSITIVE_PROFILE_DATA")).containsEntry("legalBasis", "ART_11_I");
        assertThat(byPurpose.get("FACIAL_RECOGNITION")).containsEntry("legalBasis", "ART_11_I");
        assertThat(byPurpose.get("MARKETING")).containsEntry("legalBasis", "ART_7_I");

        ResponseEntity<Map> granted = send(HttpMethod.PUT, "/api/v1/me/consents/SENSITIVE_PROFILE_DATA", ana,
                Map.of("granted", true));
        assertThat(granted.getStatusCode().value()).isEqualTo(200);
        assertThat(granted.getBody()).containsEntry("granted", true).containsEntry("purpose", "SENSITIVE_PROFILE_DATA");
        assertThat(granted.getBody().get("updatedAt")).isNotNull();
        // repetir o mesmo valor não gera outro evento
        send(HttpMethod.PUT, "/api/v1/me/consents/SENSITIVE_PROFILE_DATA", ana, Map.of("granted", true));

        tx.executeWithoutResult(s -> {
            UserControlList u = users.findById(ana.getId()).orElseThrow();
            u.setSexualPreference("BISSEXUAL");
            users.saveAndFlush(u);
        });

        // revogar apaga a orientação sexual na hora (Art. 8º, §5º)
        ResponseEntity<Map> revoked = send(HttpMethod.PUT, "/api/v1/me/consents/SENSITIVE_PROFILE_DATA", ana,
                Map.of("granted", false));
        assertThat(revoked.getBody()).containsEntry("granted", false);
        assertThat(users.findById(ana.getId()).orElseThrow().getSexualPreference()).isNull();

        // histórico append-only: ligou e desligou, com a base legal do Art. 11
        List<Map<String, Object>> events = jdbc.queryForList(
                "SELECT granted, legal_basis, channel FROM consent_event WHERE user_id = ? ORDER BY id", ana.getId());
        assertThat(events).extracting(e -> e.get("granted")).containsExactly(true, false);
        assertThat(events).extracting(e -> e.get("legal_basis")).containsOnly("ART_11_I");
        assertThat(events).extracting(e -> e.get("channel")).containsOnly("WEB");
    }

    @Test
    void revokingLocationTrackingErasesTheLastSavedLocation() {
        tx.executeWithoutResult(s -> {
            UserControlList u = users.findById(ana.getId()).orElseThrow();
            u.setLastSavedLocation(new GeoLocation(-25.43, -49.27, Instant.now()));
            users.saveAndFlush(u);
        });
        send(HttpMethod.PUT, "/api/v1/me/consents/LOCATION_TRACKING", ana, Map.of("granted", true));
        assertThat(users.findById(ana.getId()).orElseThrow().getLastSavedLocation()).isNotNull();

        send(HttpMethod.PUT, "/api/v1/me/consents/LOCATION_TRACKING", ana, Map.of("granted", false));
        assertThat(users.findById(ana.getId()).orElseThrow().getLastSavedLocation()).isNull();
        assertThat(jdbc.queryForObject("SELECT last_saved_point IS NULL FROM \"VSusercontrolist\" WHERE id = ?",
                Boolean.class, ana.getId())).isTrue();
    }

    @Test
    void minorsCannotTurnOnProfilingMarketingTrackingSensitiveDataOrBiometrics() {
        Map<String, Map<String, Object>> byPurpose = byPurpose(send(HttpMethod.GET, "/api/v1/me/consents", teen, null).getBody());
        assertThat(locked(byPurpose)).containsExactlyInAnyOrder("LOCATION_TRACKING", "PERSONALIZED_FEED", "MARKETING",
                "SENSITIVE_PROFILE_DATA", "FACIAL_RECOGNITION");
        for (String purpose : List.of("MARKETING", "SENSITIVE_PROFILE_DATA", "FACIAL_RECOGNITION", "LOCATION_TRACKING")) {
            assertThat(send(HttpMethod.PUT, "/api/v1/me/consents/" + purpose, teen, Map.of("granted", true))
                    .getStatusCode().value()).as(purpose).isEqualTo(403);
        }
        assertThat(send(HttpMethod.PUT, "/api/v1/me/consents/MARKETING", teen, Map.of("granted", false))
                .getStatusCode().value()).isEqualTo(200);   // desligar é sempre livre
        assertThat(send(HttpMethod.PUT, "/api/v1/me/consents/THIRD_PARTY_SHARING", teen, Map.of("granted", true))
                .getStatusCode().value()).isEqualTo(200);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM consent_event WHERE user_id = ? AND granted",
                Integer.class, teen.getId())).isEqualTo(1);

        // aos 17: o ECA Digital já não trava, mas dado sensível e biometria esperam o responsável (Art. 14)
        assertThat(locked(byPurpose(send(HttpMethod.GET, "/api/v1/me/consents", older, null).getBody())))
                .containsExactlyInAnyOrder("SENSITIVE_PROFILE_DATA", "FACIAL_RECOGNITION");
        assertThat(send(HttpMethod.PUT, "/api/v1/me/consents/MARKETING", older, Map.of("granted", true))
                .getStatusCode().value()).isEqualTo(200);
        assertThat(send(HttpMethod.PUT, "/api/v1/me/consents/FACIAL_RECOGNITION", older, Map.of("granted", true))
                .getStatusCode().value()).isEqualTo(403);
    }

    @Test
    void sameValueSentFromSeveralTabsAtOnceRecordsOneEvent() {
        List<ApiClient> tabs = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            ApiClient tab = new ApiClient(port);
            assertThat(tab.login(ana.getEmail(), PASSWORD).getStatusCode().value()).isEqualTo(200);
            tab.get("/api/v1/auth/csrf");
            tabs.add(tab);
        }
        assertThat(tabs.parallelStream().map(tab -> tab.send(HttpMethod.PUT, "/api/v1/me/consents/MARKETING",
                Map.of("granted", true)).getStatusCode().value()).toList()).containsOnly(200);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM consent_event WHERE user_id = ? AND purpose = 'MARKETING'",
                Integer.class, ana.getId())).isEqualTo(1);
    }

    @Test
    void registrationRecordsTheSixPurposesOffAndTheListShowsWhen() {
        ApiClient b = new ApiClient(port);
        Map<String, Object> r = new HashMap<>();
        r.put("name", "Pessoa dora");
        r.put("handle", "dora");
        r.put("email", "dora@example.com");
        r.put("password", PASSWORD);
        r.put("userType", "VERDE");
        r.put("dateOfBirth", "1995-03-10");
        r.put("acceptTerms", true);
        r.put("termsVersion", "2026-10-17");
        r.put("typeDetails", Map.of());
        assertThat(b.post("/api/v1/auth/register", r).getStatusCode().value()).isEqualTo(201);

        List<Map<String, Object>> list = items(b.get("/api/v1/me/consents").getBody());
        assertThat(list).extracting(c -> c.get("purpose")).containsExactlyElementsOf(PURPOSES);
        assertThat(list).allSatisfy(c -> assertThat(c).containsEntry("granted", false)
                .extractingByKey("updatedAt").isNotNull());
    }

    @Test
    void rejectsUnknownCodesMissingValueAnonymousCallsAndWritesWithoutCsrf() {
        assertThat(send(HttpMethod.GET, "/api/v1/me/consents", null, null).getStatusCode().value()).isEqualTo(401);
        assertThat(send(HttpMethod.PUT, "/api/v1/me/consents/VENDER_DADOS", ana, Map.of("granted", true))
                .getStatusCode().value()).isEqualTo(404);
        assertThat(send(HttpMethod.PUT, "/api/v1/me/consents/MARKETING", ana, Map.of())
                .getStatusCode().value()).isEqualTo(422);

        // outro site com o cookie da sessão, mas sem o X-XSRF-TOKEN: não liga nada
        ApiClient browser = new ApiClient(port);
        browser.login(ana.getEmail(), PASSWORD);
        String sessionCookie = browser.cookies().entrySet().stream()
                .filter(e -> e.getKey().contains("session")).map(e -> e.getKey() + "=" + e.getValue()).findFirst().orElseThrow();
        int forged = RestClient.create("http://localhost:" + port).put().uri("/api/v1/me/consents/MARKETING")
                .header(HttpHeaders.COOKIE, sessionCookie).contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("granted", true)).exchange((req, res) -> res.getStatusCode().value());
        assertThat(forged).isEqualTo(403);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM consent_event WHERE user_id = ?", Integer.class,
                ana.getId())).isZero();
    }

    private UserControlList active(String name, String email, LocalDate birth) {
        UserControlList user = new UserControlList(name, email, passwords.encode(PASSWORD), UserCategoryEnum.VERDE);
        user.setUserDateOfBirth(birth);
        user.activate();
        return user;
    }

    private UserControlList save(UserControlList user) {
        return tx.execute(s -> users.saveAndFlush(user));
    }

    private ResponseEntity<Map> send(HttpMethod method, String path, UserControlList who, Object body) {
        ApiClient browser = who == null ? new ApiClient(port) : browsers.computeIfAbsent(who.getId(), id -> {
            ApiClient b = new ApiClient(port);
            assertThat(b.login(who.getEmail(), PASSWORD).getStatusCode().value()).isEqualTo(200);
            return b;
        });
        return browser.send(method, path, body);
    }

    private static List<String> locked(Map<String, Map<String, Object>> byPurpose) {
        return byPurpose.entrySet().stream().filter(e -> (Boolean) e.getValue().get("lockedForMinor"))
                .map(Map.Entry::getKey).toList();
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> items(Map<String, Object> body) {
        return (List<Map<String, Object>>) body.get("items");
    }

    private static Map<String, Map<String, Object>> byPurpose(Map<String, Object> body) {
        return items(body).stream().collect(Collectors.toMap(c -> (String) c.get("purpose"), c -> c));
    }
}
