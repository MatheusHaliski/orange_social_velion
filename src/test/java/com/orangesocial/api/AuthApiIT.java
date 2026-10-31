package com.orangesocial.api;

import com.orangesocial.application.account.AccountService;
import com.orangesocial.domain.model.UserControlList;
import com.orangesocial.infrastructure.persistence.postgres.UserControlListRepository;
import com.orangesocial.security.Totp;
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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Cadastro (RF1), sessão e controle de acesso (RF27), 2FA, configurações e exclusão com 30 dias para reativar
 * (RF23), ponta a ponta contra PostGIS + Valkey reais, com cookies e CSRF como um navegador.
 */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@ActiveProfiles("it")
@Import({PolyglotContainers.class, CapturingNotifier.class})
class AuthApiIT {

    static final String PASSWORD = "minha frase de acesso laranja";

    @LocalServerPort
    int port;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    StringRedisTemplate redis;

    @Autowired
    CapturingNotifier.Captured mail;

    @Autowired
    UserControlListRepository users;

    @Autowired
    AccountService accounts;

    @BeforeEach
    void clean() {
        jdbc.execute("TRUNCATE TABLE \"VSusercontrolist\" RESTART IDENTITY CASCADE");
        redis.getRequiredConnectionFactory().getConnection().serverCommands().flushDb();
        mail.codes.clear();
        mail.events.clear();
    }

    // ------------------------------------------------------------ cadastro (RF1) e sessão

    @Test
    void registerWithChosenTypeAndTermsStartsASessionThatAnIncognitoWindowDoesNotSee() {
        ApiClient browser = new ApiClient(port);
        assertThat(browser.get("/api/v1/legal/terms").getBody()).containsEntry("version", "2026-10-17");

        ResponseEntity<Map> created = browser.post("/api/v1/auth/register", registration("ana@example.com", "ana.ribeiro", "VERDE",
                "2000-05-20", Map.of("city", "Curitiba")));
        assertThat(created.getStatusCode().value()).isEqualTo(201);
        Map<String, Object> user = map(created.getBody(), "user");
        assertThat(user).containsEntry("accountStatus", "PENDING_VERIFICATION").containsEntry("handle", "ana.ribeiro")
                .containsEntry("termsUpToDate", true).containsEntry("emailVerified", false);
        assertThat(map(user, "category")).containsEntry("code", "VERDE");

        // cookie de sessão: HttpOnly, SameSite, sem Max-Age/Expires (morre ao fechar o navegador)
        assertThat(browser.lastSessionSetCookie).contains("HttpOnly").contains("SameSite=Lax")
                .doesNotContain("Max-Age").doesNotContain("Expires");
        assertThat(browser.get("/api/v1/auth/session").getStatusCode().value()).isEqualTo(200);

        ApiClient incognito = new ApiClient(port);
        assertThat(incognito.get("/api/v1/auth/session").getStatusCode().value()).isEqualTo(401);
        assertThat(incognito.get("/api/v1/me").getStatusCode().value()).isEqualTo(401);

        // Privacy by Default (RF3) e aceite dos termos gravados na mesma transação
        Long id = ((Number) user.get("id")).longValue();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM consent_event WHERE user_id = ? AND NOT granted", Integer.class, id))
                .isEqualTo(6);
        assertThat(jdbc.queryForObject("SELECT version FROM terms_acceptance WHERE user_id = ?", String.class, id))
                .isEqualTo("2026-10-17");

        // verificação de e-mail
        assertThat(browser.post("/api/v1/me/verify-email", Map.of("code", "000000")).getStatusCode().value()).isEqualTo(422);
        Map<String, Object> verified = browser.post("/api/v1/me/verify-email", Map.of("code", mail.codes.get("ana@example.com"))).getBody();
        assertThat(verified).containsEntry("accountStatus", "ACTIVE").containsEntry("emailVerified", true);
    }

    @Test
    void registrationRulesTermsTypeFieldsAgeAndUniqueness() {
        ApiClient browser = new ApiClient(port);
        Map<String, Object> noTerms = registration("x@example.com", "xx_user", "VERDE", "2000-01-01", Map.of());
        noTerms.put("acceptTerms", false);
        ResponseEntity<Map> refused = browser.post("/api/v1/auth/register", noTerms);
        assertThat(refused.getStatusCode().value()).isEqualTo(422);
        assertThat((List<String>) refused.getBody().get("errors")).anyMatch(e -> e.contains("Termos de Uso da Velion"));

        ResponseEntity<Map> institution = browser.post("/api/v1/auth/register",
                registration("gov@example.com", "prefeitura", "VERMELHO", "1980-01-01", Map.of("subtype", "GOVERNMENT")));
        assertThat(institution.getStatusCode().value()).isEqualTo(422);
        assertThat((List<String>) institution.getBody().get("errors")).anyMatch(e -> e.contains("cnpj"));

        Map<String, Object> govDetails = Map.of("subtype", "GOVERNMENT", "cnpj", "12.ABC.345/01DE-35",
                "legalName", "Município de Exemplo", "website", "https://exemplo.pr.gov.br", "sector", "Administração pública",
                "representativeName", "Fulana", "representativeRole", "Secretária", "representativeEmail", "fulana@exemplo.pr.gov.br");
        ResponseEntity<Map> gov = new ApiClient(port).post("/api/v1/auth/register",
                registration("gov@example.com", "prefeitura", "VERMELHO", "1980-01-01", govDetails));
        assertThat(gov.getStatusCode().value()).isEqualTo(201);
        assertThat(map(gov.getBody(), "user")).containsEntry("categoryVerification", "PENDING");

        assertThat(browser.post("/api/v1/auth/register",
                registration("kid@example.com", "kid_user", "VERDE", Instant.now().minus(Duration.ofDays(365 * 10)).toString().substring(0, 10), Map.of()))
                .getStatusCode().value()).isEqualTo(422);
        assertThat(new ApiClient(port).post("/api/v1/auth/register",
                registration("GOV@example.com", "outro_handle", "VERDE", "1990-01-01", Map.of())).getStatusCode().value())
                .isEqualTo(409);
    }

    // ------------------------------------------------------------ login, limite de tentativas e logout

    @Test
    void wrongPasswordIsNeutralThenThrottledAndLogoutKillsTheSessionEverywhere() {
        register("bia@example.com", "bia");
        ApiClient attacker = new ApiClient(port);
        ResponseEntity<Map> wrong = attacker.login("bia@example.com", "senha errada qualquer");
        ResponseEntity<Map> unknown = attacker.login("ninguem@example.com", "senha errada qualquer");
        assertThat(wrong.getStatusCode().value()).isEqualTo(401);
        assertThat(wrong.getBody().get("detail")).isEqualTo(unknown.getBody().get("detail")).isEqualTo("E-mail ou senha incorretos.");
        for (int i = 0; i < 4; i++) {
            attacker.login("bia@example.com", "senha errada qualquer");
        }
        ResponseEntity<Map> throttled = attacker.login("bia@example.com", PASSWORD);
        assertThat(throttled.getStatusCode().value()).isEqualTo(429);
        assertThat(throttled.getHeaders().getFirst("Retry-After")).isNotNull();

        redis.getRequiredConnectionFactory().getConnection().serverCommands().flushDb();
        ApiClient tab1 = new ApiClient(port);
        assertThat(tab1.login("bia@example.com", PASSWORD).getBody()).containsEntry("status", "AUTHENTICATED");
        ApiClient tab2 = new ApiClient(port);
        tab2.cookies().putAll(tab1.cookies());   // outra aba da mesma janela: mesmo cookie
        assertThat(tab2.get("/api/v1/me").getStatusCode().value()).isEqualTo(200);

        assertThat(tab1.post("/api/v1/auth/logout", null).getStatusCode().value()).isEqualTo(204);
        assertThat(tab2.get("/api/v1/me").getStatusCode().value()).isEqualTo(401);
    }

    @Test
    void writesWithoutCsrfTokenAreRejected() {
        register("csrf@example.com", "csrf_user");
        ApiClient browser = new ApiClient(port);
        browser.login("csrf@example.com", PASSWORD);
        String sessionCookie = browser.cookies().entrySet().stream()
                .filter(e -> e.getKey().contains("session")).map(e -> e.getKey() + "=" + e.getValue()).findFirst().orElseThrow();

        // outro site tentando usar o cookie da vítima: sem o token não passa
        int forged = RestClient.create("http://localhost:" + port).patch().uri("/api/v1/me/preferences")
                .header(HttpHeaders.COOKIE, sessionCookie).contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .body(Map.of("theme", "DARK")).exchange((req, res) -> res.getStatusCode().value());
        assertThat(forged).isEqualTo(403);
        assertThat(browser.send(HttpMethod.PATCH, "/api/v1/me/preferences", Map.of("theme", "DARK")).getStatusCode().value())
                .isEqualTo(200);
    }

    // ------------------------------------------------------------ 2FA

    @Test
    void enableTotpThenLoginNeedsCodeAndRecoveryCodesWorkOnce() {
        register("caio@example.com", "caio");
        ApiClient browser = new ApiClient(port);
        browser.login("caio@example.com", PASSWORD);

        assertThat(browser.post("/api/v1/me/mfa/totp", Map.of("password", "errada errada errada")).getStatusCode().value())
                .isEqualTo(403);
        Map<String, Object> setup = browser.post("/api/v1/me/mfa/totp", Map.of("password", PASSWORD)).getBody();
        assertThat((String) setup.get("otpauthUri")).startsWith("otpauth://totp/Orange%20Social%3Acaio%40example.com?secret=");
        byte[] secret = Totp.fromBase32((String) setup.get("secret"));
        long step = Totp.stepAt(Instant.now());

        Map<String, Object> codes = browser.post("/api/v1/me/mfa/totp/confirm",
                Map.of("code", Totp.code(secret, step, 6))).getBody();
        List<String> recovery = (List<String>) codes.get("codes");
        assertThat(recovery).hasSize(10).allMatch(c -> c.matches("[a-z2-9]{5}-[a-z2-9]{5}"));
        assertThat(mail.events).contains("mfa-true:caio@example.com");

        ApiClient other = new ApiClient(port);
        assertThat(other.login("caio@example.com", PASSWORD).getBody()).containsEntry("status", "MFA_REQUIRED");
        assertThat(other.get("/api/v1/me").getStatusCode().value()).isEqualTo(401);   // meia-sessão não vale
        assertThat(other.post("/api/v1/auth/login/2fa", Map.of("code", Totp.code(secret, step, 6))).getStatusCode().value())
                .isEqualTo(401);                                                        // mesmo código: anti-replay
        assertThat(other.post("/api/v1/auth/login/2fa", Map.of("code", Totp.code(secret, step + 1, 6))).getBody())
                .containsEntry("status", "AUTHENTICATED");

        ApiClient third = new ApiClient(port);
        third.login("caio@example.com", PASSWORD);
        assertThat(third.post("/api/v1/auth/login/2fa", Map.of("code", recovery.getFirst())).getBody())
                .containsEntry("status", "AUTHENTICATED");
        ApiClient fourth = new ApiClient(port);
        fourth.login("caio@example.com", PASSWORD);
        assertThat(fourth.post("/api/v1/auth/login/2fa", Map.of("code", recovery.getFirst())).getStatusCode().value())
                .isEqualTo(401);
        assertThat(third.get("/api/v1/me/mfa").getBody()).containsEntry("recoveryCodesLeft", 9);
    }

    @Test
    @SuppressWarnings("unchecked")
    void secondFactorIsSingleUseUnderConcurrencyAndSetupNeverOverwritesAnActiveFactor() throws Exception {
        register("dora@example.com", "dora");
        ApiClient a = new ApiClient(port);
        a.login("dora@example.com", PASSWORD);
        ApiClient b = new ApiClient(port);
        b.login("dora@example.com", PASSWORD);

        // duas configurações abertas ao mesmo tempo: a segunda confirmação não troca o fator que a primeira ligou
        byte[] secretA = Totp.fromBase32((String) a.post("/api/v1/me/mfa/totp", Map.of("password", PASSWORD)).getBody().get("secret"));
        byte[] secretB = Totp.fromBase32((String) b.post("/api/v1/me/mfa/totp", Map.of("password", PASSWORD)).getBody().get("secret"));
        long step = Totp.stepAt(Instant.now());
        List<String> recovery = (List<String>) a.post("/api/v1/me/mfa/totp/confirm",
                Map.of("code", Totp.code(secretA, step, 6))).getBody().get("codes");
        assertThat(b.post("/api/v1/me/mfa/totp/confirm", Map.of("code", Totp.code(secretB, step, 6)))
                .getStatusCode().value()).isEqualTo(409);

        // o mesmo código TOTP (ou de recuperação) mandado por 8 logins ao mesmo tempo autentica só um
        String totp = Totp.code(secretA, step + 1, 6);
        assertThat(concurrentSecondFactor(totp, 8)).isEqualTo(1);
        assertThat(concurrentSecondFactor(recovery.getFirst(), 8)).isEqualTo(1);
        assertThat(a.get("/api/v1/me/mfa").getBody()).containsEntry("recoveryCodesLeft", 9);
    }

    // ------------------------------------------------------------ sessões ativas

    @Test
    void listsSessionsWithoutRealIdsAndEndsTheOthers() {
        register("davi@example.com", "davi");
        ApiClient phone = new ApiClient(port);
        phone.login("davi@example.com", PASSWORD);
        ApiClient laptop = new ApiClient(port);
        laptop.login("davi@example.com", PASSWORD);

        // o cadastro já abriu uma sessão: cadastro + celular + notebook
        List<Map<String, Object>> list = laptop.getList("/api/v1/me/sessions").getBody();
        assertThat(list).hasSize(3);
        assertThat(list.getFirst()).containsEntry("current", true);
        assertThat(list).noneMatch(s -> laptop.cookies().containsValue(s.get("id")));

        assertThat(laptop.send(HttpMethod.DELETE, "/api/v1/me/sessions", null).getBody()).containsEntry("closed", 2);
        assertThat(phone.get("/api/v1/me").getStatusCode().value()).isEqualTo(401);
        assertThat(laptop.get("/api/v1/me").getStatusCode().value()).isEqualTo(200);
    }

    // ------------------------------------------------------------ configurações e perfil (RF2)

    @Test
    void preferencesIncludingAppBackgroundAndProfileEditing() {
        register("eva@example.com", "eva");
        ApiClient browser = new ApiClient(port);
        browser.login("eva@example.com", PASSWORD);

        assertThat(browser.get("/api/v1/me/preferences").getBody()).containsEntry("appBackground", "PLAIN")
                .containsEntry("theme", "SYSTEM").containsEntry("profilePrivate", false);
        Map<String, Object> updated = browser.send(HttpMethod.PATCH, "/api/v1/me/preferences",
                Map.of("appBackground", "MOSAIC_SAND", "theme", "DARK", "fontScale", 115,
                        "notifications", Map.of("likes", false))).getBody();
        assertThat(updated).containsEntry("appBackground", "MOSAIC_SAND").containsEntry("theme", "DARK")
                .containsEntry("fontScale", 115);
        assertThat(map(updated, "notifications")).containsEntry("likes", false).containsEntry("comments", true);
        assertThat(browser.send(HttpMethod.PATCH, "/api/v1/me/preferences", Map.of("appBackground", "PAPEL_DE_PAREDE"))
                .getStatusCode().value()).isEqualTo(400);

        Map<String, Object> profile = browser.send(HttpMethod.PATCH, "/api/v1/me/profile",
                Map.of("bio", "Pedalando por Curitiba", "pronouns", List.of("ela"), "links", List.of("https://eva.example"))).getBody();
        assertThat(profile).containsEntry("bio", "Pedalando por Curitiba");
        register("fabio@example.com", "fabio");
        assertThat(browser.send(HttpMethod.PATCH, "/api/v1/me/profile", Map.of("handle", "fabio")).getStatusCode().value())
                .isEqualTo(409);
    }

    @Test
    void minorsKeepProtectiveDefaults() {
        String birth = Instant.now().minus(Duration.ofDays(365 * 14 + 10)).toString().substring(0, 10);
        ApiClient browser = new ApiClient(port);
        assertThat(browser.post("/api/v1/auth/register", registration("teen@example.com", "teen", "VERDE", birth, Map.of()))
                .getStatusCode().value()).isEqualTo(422);   // sem e-mail do responsável
        assertThat(browser.post("/api/v1/auth/register", registration("teen@example.com", "teen", "VERDE", birth,
                Map.of("guardianEmail", "mae@example.com"))).getStatusCode().value()).isEqualTo(201);

        assertThat(browser.get("/api/v1/me/preferences").getBody()).containsEntry("profilePrivate", true)
                .containsEntry("minorProtectionsLocked", true);
        assertThat(browser.send(HttpMethod.PATCH, "/api/v1/me/preferences", Map.of("profilePrivate", false))
                .getStatusCode().value()).isEqualTo(403);
        assertThat(browser.send(HttpMethod.PATCH, "/api/v1/me/preferences", Map.of("appBackground", "MOSAIC"))
                .getStatusCode().value()).isEqualTo(200);
    }

    // ------------------------------------------------------------ excluir conta com 30 dias para reativar (RF23)

    @Test
    void deletionHidesAccountAllowsReactivationWithin30DaysAndEliminatesAfter() {
        register("gil@example.com", "gil");
        ApiClient browser = new ApiClient(port);
        browser.login("gil@example.com", PASSWORD);
        ApiClient otherDevice = new ApiClient(port);
        otherDevice.login("gil@example.com", PASSWORD);

        assertThat(browser.post("/api/v1/me/deletion", Map.of("password", PASSWORD, "confirm", false)).getStatusCode().value())
                .isEqualTo(422);
        ResponseEntity<Map> scheduled = browser.post("/api/v1/me/deletion", Map.of("password", PASSWORD, "confirm", true));
        assertThat(scheduled.getStatusCode().value()).isEqualTo(202);
        assertThat(scheduled.getBody()).containsEntry("accountStatus", "PENDING_DELETION").containsEntry("graceDays", 30);
        assertThat(Instant.parse((String) scheduled.getBody().get("deletionScheduledFor")))
                .isBetween(Instant.now().plus(Duration.ofDays(29)), Instant.now().plus(Duration.ofDays(31)));
        assertThat(browser.get("/api/v1/me").getStatusCode().value()).isEqualTo(401);
        assertThat(otherDevice.get("/api/v1/me").getStatusCode().value()).isEqualTo(401);

        ApiClient back = new ApiClient(port);
        assertThat(back.login("gil@example.com", PASSWORD).getBody()).containsEntry("status", "REACTIVATION_AVAILABLE");
        assertThat(back.get("/api/v1/me").getStatusCode().value()).isEqualTo(401);
        Map<String, Object> reactivated = back.post("/api/v1/auth/reactivate", null).getBody();
        assertThat(reactivated).containsEntry("status", "AUTHENTICATED");
        assertThat(map(reactivated, "user")).containsEntry("accountStatus", "PENDING_VERIFICATION");

        back.post("/api/v1/me/deletion", Map.of("password", PASSWORD, "confirm", true));
        UserControlList gil = users.findByEmail("gil@example.com").orElseThrow();
        jdbc.update("UPDATE \"VSusercontrolist\" SET deletion_scheduled_for = now() - interval '1 minute' WHERE id = ?", gil.getId());
        assertThat(accounts.dueForElimination()).containsExactly(gil.getId());
        accounts.eliminate(gil.getId());

        UserControlList gone = users.findById(gil.getId()).orElseThrow();
        assertThat(gone.getAccountStatus().name()).isEqualTo("ANONYMOUS_LGPD_DELETED");
        assertThat(gone.getEmail()).doesNotContain("gil");
        assertThat(gone.getHandle()).isNull();
        assertThat(new ApiClient(port).login("gil@example.com", PASSWORD).getStatusCode().value()).isEqualTo(401);
    }

    // ------------------------------------------------------------ apoio

    /** Abre {@code n} logins na etapa do 2FA e manda o mesmo código em todos ao mesmo tempo; devolve quantos entraram. */
    private int concurrentSecondFactor(String code, int n) throws Exception {
        List<ApiClient> clients = new java.util.ArrayList<>();
        for (int i = 0; i < n; i++) {
            ApiClient c = new ApiClient(port);
            assertThat(c.login("dora@example.com", PASSWORD).getBody()).containsEntry("status", "MFA_REQUIRED");
            clients.add(c);
        }
        java.util.concurrent.CountDownLatch start = new java.util.concurrent.CountDownLatch(1);
        try (var pool = java.util.concurrent.Executors.newFixedThreadPool(n)) {
            List<java.util.concurrent.Future<Integer>> results = new java.util.ArrayList<>();
            for (ApiClient c : clients) {
                results.add(pool.submit(() -> {
                    start.await();
                    return c.post("/api/v1/auth/login/2fa", Map.of("code", code)).getStatusCode().value();
                }));
            }
            start.countDown();
            int ok = 0;
            for (var r : results) {
                ok += r.get() == 200 ? 1 : 0;
            }
            return ok;
        }
    }

    private void register(String email, String handle) {
        ApiClient b = new ApiClient(port);
        assertThat(b.post("/api/v1/auth/register", registration(email, handle, "VERDE", "1995-03-10", Map.of()))
                .getStatusCode().value()).isEqualTo(201);
    }

    private static Map<String, Object> registration(String email, String handle, String type, String birth,
                                                    Map<String, Object> details) {
        Map<String, Object> r = new HashMap<>();
        r.put("name", "Pessoa " + handle);
        r.put("handle", handle);
        r.put("email", email);
        r.put("password", PASSWORD);
        r.put("userType", type);
        r.put("dateOfBirth", birth);
        r.put("acceptTerms", true);
        r.put("termsVersion", "2026-10-17");
        r.put("typeDetails", details);
        return r;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> map(Map<String, Object> parent, String key) {
        return (Map<String, Object>) parent.get(key);
    }
}
