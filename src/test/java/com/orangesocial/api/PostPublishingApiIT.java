package com.orangesocial.api;

import com.orangesocial.domain.model.CategoryVerification;
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
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Ponta a ponta: publicar post de texto (RF29) com moldura (RF28), ler a moldura resolvida no detalhe e no feed do
 * autor, editar, arquivar, restaurar, apagar e o catálogo público com ETag.
 */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@ActiveProfiles("it")
@Import({PolyglotContainers.class, CapturingNotifier.class})
class PostPublishingApiIT {

    static final String PASSWORD = "uma frase longa de teste";

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
    UserControlList author;
    UserControlList institution;
    UserControlList pending;
    UserControlList minor;
    UserControlList other;

    @BeforeEach
    void seed() {
        jdbc.execute("TRUNCATE TABLE \"VSusercontrolist\" RESTART IDENTITY CASCADE");
        redis.getRequiredConnectionFactory().getConnection().serverCommands().flushDb();
        browsers.clear();
        author = save(active("Ana Ribeiro", "ana@example.com", UserCategoryEnum.VERDE, LocalDate.of(1994, 5, 2)));
        other = save(active("João Martins", "joao@example.com", UserCategoryEnum.VERDE, LocalDate.of(1990, 1, 1)));
        UserControlList inst = active("Nimbus Tecnologia", "rh@nimbus.example", UserCategoryEnum.VERMELHO, LocalDate.of(1980, 3, 3));
        inst.setCategoryVerification(CategoryVerification.PENDING);
        institution = save(inst);
        pending = save(new UserControlList("Pendente", "pend@example.com", passwords.encode(PASSWORD), UserCategoryEnum.VERDE));
        minor = save(active("Bia", "bia@example.com", UserCategoryEnum.VERDE, LocalDate.now().minusYears(14)));
    }

    @Test
    void publishesTextPostWithFrameAndReadsItResolved() {
        ResponseEntity<Map> created = send(HttpMethod.POST, "/api/v1/posts", author, Map.of(
                "title", "  Fim de tarde no Parque Barigui  ",
                "subtitle", "Levei a câmera nova",
                "country", "br", "city", "Curitiba",
                "background", Map.of("auraPlusId", "brasa", "auraHypeStyle", "SCANNER")));
        assertThat(created.getStatusCode().value()).isEqualTo(201);
        Map<String, Object> post = created.getBody();
        assertThat(post).containsEntry("title", "Fim de tarde no Parque Barigui").containsEntry("status", "PUBLISHED")
                .containsEntry("country", "BR");
        Map<String, Object> bg = map(post, "background");
        assertThat(bg).containsEntry("artKind", "AURA_PLUS").containsEntry("artId", "brasa");
        assertThat(map(bg, "auraPlus")).containsEntry("maxPlaySeconds", 5);
        assertThat((String) map(bg, "auraPlus").get("av1")).endsWith("/backgrounds/aura-plus/brasa-hq.mp4");
        assertThat(map(bg, "container")).containsEntry("color", "#211A12").containsEntry("ink", "#F5EDE3");
        assertThat(map(map(bg, "config"), "container")).containsEntry("ink", "AUTO");

        String id = (String) post.get("id");
        assertThat(jdbc.queryForObject("SELECT background->>'auraPlusId' FROM post WHERE id = ?::uuid", String.class, id))
                .isEqualTo("brasa");

        // visitante lê a moldura no detalhe e no feed do autor
        assertThat(map(send(HttpMethod.GET, "/api/v1/posts/" + id, null, null).getBody(), "background"))
                .containsEntry("artKind", "AURA_PLUS");
        List<Map<String, Object>> items = list(send(HttpMethod.GET, "/api/v1/users/" + author.getId() + "/posts", null, null).getBody(), "items");
        assertThat(map(items.getFirst(), "background")).containsEntry("artId", "brasa");
    }

    @Test
    void invalidFrameAndFieldsComeBackTogetherAs422() {
        ResponseEntity<Map> r = send(HttpMethod.POST, "/api/v1/posts", author, Map.of(
                "title", "",
                "background", Map.of("gradientId", "oceano", "aura", Map.of("presetId", "mare"),
                        "container", Map.of("color", "#F5EDE3", "ink", "#FF9D5E"), "css", "url(https://x)")));
        assertThat(r.getStatusCode().value()).isEqualTo(422);
        List<String> errors = list(r.getBody(), "errors").stream().map(String::valueOf).toList();
        assertThat(errors).anyMatch(e -> e.contains("título"))
                .anyMatch(e -> e.contains("background.css"))
                .anyMatch(e -> e.contains("única arte"))
                .anyMatch(e -> e.contains("1,8:1"));

        assertThat(send(HttpMethod.POST, "/api/v1/posts", author, Map.of("title", "Alerta", "feed", "ALERT"))
                .getStatusCode().value()).isEqualTo(422);
        assertThat(send(HttpMethod.POST, "/api/v1/posts", author, Map.of("title", "Foto", "mediaType", "IMAGE"))
                .getStatusCode().value()).isEqualTo(422);
    }

    @Test
    void onlyActiveVerifiedAdultsPublishAndMinorsKeepCatalogFrames() {
        assertThat(send(HttpMethod.POST, "/api/v1/posts", null, Map.of("title", "Oi")).getStatusCode().value()).isEqualTo(401);
        assertThat(send(HttpMethod.POST, "/api/v1/posts", pending, Map.of("title", "Oi")).getStatusCode().value()).isEqualTo(403);
        ResponseEntity<Map> seal = send(HttpMethod.POST, "/api/v1/posts", institution, Map.of("title", "Vaga"));
        assertThat(seal.getStatusCode().value()).isEqualTo(403);
        assertThat((String) seal.getBody().get("detail")).contains("verificação");

        assertThat(send(HttpMethod.POST, "/api/v1/posts", minor, Map.of("title", "Meu desenho",
                "background", Map.of("customArt", Map.of("assetId", "a1", "origin", "IA")))).getStatusCode().value()).isEqualTo(403);
        assertThat(send(HttpMethod.POST, "/api/v1/posts", minor, Map.of("title", "Só para maiores", "ageRating", "AGE_18"))
                .getStatusCode().value()).isEqualTo(422);
        assertThat(send(HttpMethod.POST, "/api/v1/posts", minor, Map.of("title", "Meu desenho",
                "background", Map.of("aura", Map.of("presetId", "confete")))).getStatusCode().value()).isEqualTo(201);
    }

    @Test
    void authorEditsArchivesRestoresAndDeletesOwnPost() {
        String id = (String) send(HttpMethod.POST, "/api/v1/posts", author, Map.of("title", "Primeira versão",
                "background", Map.of("gradientId", "oceano"))).getBody().get("id");
        String path = "/api/v1/posts/" + id;

        Map<String, Object> patch = new HashMap<>();
        patch.put("title", "Segunda versão");
        patch.put("background", Map.of("seasonal", Map.of("auto", true)));
        Map<String, Object> edited = send(HttpMethod.PATCH, path, author, patch).getBody();
        assertThat(edited).containsEntry("title", "Segunda versão");
        assertThat(map(edited, "background")).containsEntry("artKind", "SEASONAL");

        Map<String, Object> clear = new HashMap<>();
        clear.put("background", null);
        assertThat(send(HttpMethod.PATCH, path, author, clear).getBody().get("background")).isNull();
        assertThat(send(HttpMethod.PATCH, path, author, Map.of("authorUserId", 99)).getStatusCode().value()).isEqualTo(422);

        assertThat(send(HttpMethod.PATCH, path, other, Map.of("title", "invadido")).getStatusCode().value()).isEqualTo(404);
        assertThat(send(HttpMethod.POST, path + "/archive", author, null).getBody()).containsEntry("status", "ARCHIVED");
        assertThat(send(HttpMethod.POST, path + "/archive", author, null).getStatusCode().value()).isEqualTo(409);
        assertThat(send(HttpMethod.POST, path + "/restore", author, null).getBody()).containsEntry("status", "PUBLISHED");
        assertThat(send(HttpMethod.DELETE, path, other, null).getStatusCode().value()).isEqualTo(404);
        assertThat(send(HttpMethod.DELETE, path, author, null).getStatusCode().value()).isEqualTo(204);
        assertThat(send(HttpMethod.GET, path, null, null).getStatusCode().value()).isEqualTo(404);
        assertThat(jdbc.queryForObject("SELECT background IS NULL FROM post WHERE id = ?::uuid", Boolean.class, id)).isTrue();
    }

    @Test
    void publicCatalogHasEtagAndRecommendationsFollowTheCategory() throws Exception {
        ResponseEntity<Map> catalog = send(HttpMethod.GET, "/api/v1/backgrounds/catalog", null, null);
        assertThat(catalog.getStatusCode().value()).isEqualTo(200);
        assertThat(list(catalog.getBody(), "auras")).hasSize(8);
        Map<String, Object> body = catalog.getBody();
        assertThat(list(body, "auraPlus").stream().map(m -> m.get("id")).toList()).containsExactly("brasa", "aurora");
        assertThat(map(catalog.getBody(), "rules")).containsEntry("maxAnimationSeconds", 5);
        String etag = catalog.getHeaders().getFirst(HttpHeaders.ETAG);
        assertThat(etag).isNotBlank();

        HttpResponse<String> again = HttpClient.newHttpClient().send(HttpRequest.newBuilder(
                        URI.create("http://localhost:" + port + "/api/v1/backgrounds/catalog"))
                .header(HttpHeaders.IF_NONE_MATCH, etag).GET().build(), HttpResponse.BodyHandlers.ofString());
        assertThat(again.statusCode()).isEqualTo(304);

        ResponseEntity<List> recs = new ApiClient(port).getList("/api/v1/backgrounds/recommendations?category=VERDE&media=TEXT");
        assertThat(recs.getStatusCode().value()).isEqualTo(200);
        assertThat((Map<String, Object>) recs.getBody().getFirst()).containsEntry("auraId", "eclipse").containsEntry("materialId", "vidro");
    }

    // ------------------------------------------------------------ apoio

    private UserControlList active(String name, String email, UserCategoryEnum category, LocalDate birth) {
        UserControlList user = new UserControlList(name, email, passwords.encode(PASSWORD), category);
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

    @SuppressWarnings("unchecked")
    private static Map<String, Object> map(Map<String, Object> parent, String key) {
        return (Map<String, Object>) parent.get(key);
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> list(Map<String, Object> parent, String key) {
        return (List<Map<String, Object>>) parent.get(key);
    }
}
