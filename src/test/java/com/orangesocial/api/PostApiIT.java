package com.orangesocial.api;

import com.orangesocial.application.post.PostContentEraser;
import com.orangesocial.domain.model.FeedType;
import com.orangesocial.domain.model.MediaType;
import com.orangesocial.domain.model.Post;
import com.orangesocial.domain.model.UserCategoryEnum;
import com.orangesocial.domain.model.UserControlList;
import com.orangesocial.infrastructure.persistence.postgres.PostRepository;
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
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Ponta a ponta contra PostGIS real: Flyway V1+V2, validação das entidades, contadores
 * atômicos e as regras de visibilidade de RF24 (modal), RF25 (perfil do autor) e RF26 (interações).
 */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@ActiveProfiles("it")
@Import({PolyglotContainers.class, CapturingNotifier.class})
class PostApiIT {

    @LocalServerPort
    int port;

    @Autowired
    UserControlListRepository users;

    @Autowired
    PostRepository posts;

    @Autowired
    PostContentEraser eraser;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    TransactionTemplate tx;

    @Autowired
    PasswordEncoder passwords;

    @Autowired
    StringRedisTemplate redis;

    static final String PASSWORD = "uma frase longa de teste";

    /** Um "navegador" logado por usuário (sessão + CSRF reais); anônimo = navegador sem cookies. */
    final Map<Long, ApiClient> browsers = new HashMap<>();
    final Map<Long, String> emails = new HashMap<>();
    UserControlList author;
    UserControlList reader;
    UserControlList pending;
    Post published;

    @BeforeEach
    void seed() {
        jdbc.execute("TRUNCATE TABLE \"VSusercontrolist\" RESTART IDENTITY CASCADE");
        redis.getRequiredConnectionFactory().getConnection().serverCommands().flushDb();   // sessões e contadores
        browsers.clear();
        emails.clear();

        author = activeUser("techblog.br", "tech@example.com", UserCategoryEnum.AMARELO);
        author.setPhotoObjectKey("users/1/avatar.webp");
        author.setCityOfResidence("Curitiba");
        author = tx.execute(s -> users.saveAndFlush(author));
        reader = tx.execute(s -> users.saveAndFlush(activeUser("Ana Ribeiro", "ana@example.com", UserCategoryEnum.VERDE)));
        pending = tx.execute(s -> users.saveAndFlush(
                new UserControlList("Pendente", "pend@example.com", passwords.encode(PASSWORD), UserCategoryEnum.VERDE)));
        for (UserControlList u : List.of(author, reader, pending)) {
            emails.put(u.getId(), u.getEmail());
        }

        published = newPost(author, "O que ninguém te conta sobre começar a programar", p -> {
            p.setSubtitle("Seis meses depois");
            p.setBody("Texto completo do post.");
            p.setMediaObjectKey("posts/video.mp4");
            p.publish();
        });
    }

    // ------------------------------------------------------------ RF24 · modal com dados completos

    @Test
    void anonymousVisitorOpensFullPostWithAuthorDateAndCounts() {
        ResponseEntity<Map> res = get("/api/v1/posts/" + published.getId(), null);

        assertThat(res.getStatusCode().value()).isEqualTo(200);
        Map<String, Object> body = res.getBody();
        assertThat(body).containsEntry("title", published.getTitle())
                .containsEntry("subtitle", "Seis meses depois")
                .containsEntry("body", "Texto completo do post.")
                .containsEntry("mediaUrl", "http://localhost:3900/orange-social-media/posts/video.mp4")
                .containsEntry("ageRatingLabel", "Livre")
                .containsEntry("interactionsOpen", true)
                .containsEntry("shareUrl", "http://localhost:3000/p/" + published.getId());
        assertThat(Instant.parse((String) body.get("publishedAt"))).isEqualTo(published.getCreatedAt());

        Map<String, Object> owner = map(body, "author");
        assertThat(owner).containsEntry("name", "techblog.br")
                .containsEntry("profilePath", "/api/v1/users/" + author.getId() + "/profile")
                .containsEntry("avatarUrl", "http://localhost:3900/orange-social-media/users/1/avatar.webp")
                .containsEntry("available", true);
        assertThat(map(owner, "category")).containsEntry("code", "AMARELO").containsEntry("color", "#F7C948");
        assertThat(map(body, "counts")).containsEntry("likes", 0).containsEntry("comments", 0).containsEntry("shares", 0);
        assertThat(map(body, "viewer")).containsEntry("liked", false).containsEntry("saved", false);
    }

    @Test
    void draftOfSomeoneElseRemovedPostAndSuspendedAuthorAnswer404() {
        Post draft = newPost(author, "Rascunho", p -> { });
        assertThat(get("/api/v1/posts/" + draft.getId(), reader.getId()).getStatusCode().value()).isEqualTo(404);
        assertThat(get("/api/v1/posts/" + draft.getId(), author.getId()).getStatusCode().value()).isEqualTo(200);

        Post removed = newPost(author, "Removido", p -> { p.publish(); p.remove(); });
        assertThat(get("/api/v1/posts/" + removed.getId(), author.getId()).getStatusCode().value()).isEqualTo(404);

        tx.executeWithoutResult(s -> users.findById(author.getId()).orElseThrow().suspend());
        assertThat(get("/api/v1/posts/" + published.getId(), reader.getId()).getStatusCode().value()).isEqualTo(404);
        assertThat(get("/api/v1/users/" + author.getId() + "/profile", null).getStatusCode().value()).isEqualTo(404);
    }

    // ------------------------------------------------------------ RF25 · perfil e feed do autor

    @Test
    void profileShowsOnlyPublicDataAndFeedPagesByCursor() {
        newPost(author, "Segundo", Post::publish);
        newPost(author, "Arquivado", p -> { p.publish(); p.archive(); });
        newPost(author, "Rascunho", p -> { });

        Map<String, Object> profile = get("/api/v1/users/" + author.getId() + "/profile", null).getBody();
        assertThat(profile).containsEntry("name", "techblog.br")
                .containsEntry("postCount", 3)
                .containsEntry("postsPath", "/api/v1/users/" + author.getId() + "/posts")
                .doesNotContainKeys("email", "cityOfResidence", "city", "cellphoneNumber");

        Map<String, Object> page1 = get("/api/v1/users/" + author.getId() + "/posts?limit=2", reader.getId()).getBody();
        List<Map<String, Object>> items1 = list(page1, "items");
        assertThat(items1).extracting(i -> i.get("title")).containsExactly("Arquivado", "Segundo");
        assertThat(items1.getFirst()).doesNotContainKey("body").containsKey("detailPath");
        assertThat(page1.get("nextCursor")).isNotNull();

        Map<String, Object> page2 = get("/api/v1/users/" + author.getId() + "/posts?limit=2&cursor="
                + page1.get("nextCursor"), reader.getId()).getBody();
        assertThat(list(page2, "items")).extracting(i -> i.get("title")).containsExactly(published.getTitle());
        assertThat(page2.get("nextCursor")).isNull();

        assertThat(get("/api/v1/users/" + author.getId() + "/posts?cursor=lixo", null).getStatusCode().value())
                .isEqualTo(400);
    }

    // ------------------------------------------------------------ RF26 · curtir

    @Test
    void likeIsIdempotentAndCountedOnceAndRequiresActiveLogin() {
        String like = "/api/v1/posts/" + published.getId() + "/like";

        assertThat(send(HttpMethod.PUT, like, null, null).getStatusCode().value()).isEqualTo(401);
        assertThat(send(HttpMethod.PUT, like, pending.getId(), null).getStatusCode().value()).isEqualTo(403);

        assertThat(send(HttpMethod.PUT, like, reader.getId(), null).getBody()).containsEntry("likes", 1);
        assertThat(send(HttpMethod.PUT, like, reader.getId(), null).getBody())
                .containsEntry("liked", true).containsEntry("likes", 1);
        assertThat(send(HttpMethod.PUT, like, author.getId(), null).getBody()).containsEntry("likes", 2);

        Map<String, Object> detail = get("/api/v1/posts/" + published.getId(), reader.getId()).getBody();
        assertThat(map(detail, "viewer")).containsEntry("liked", true);
        assertThat(map(detail, "counts")).containsEntry("likes", 2);

        assertThat(send(HttpMethod.DELETE, like, reader.getId(), null).getBody()).containsEntry("likes", 1);
        assertThat(send(HttpMethod.DELETE, like, reader.getId(), null).getBody())
                .containsEntry("liked", false).containsEntry("likes", 1);
    }

    @Test
    void archivedPostIsReadableButClosedForNewInteractions() {
        Post archived = newPost(author, "Arquivado", p -> { p.publish(); p.archive(); });

        assertThat(send(HttpMethod.PUT, "/api/v1/posts/" + archived.getId() + "/like", reader.getId(), null)
                .getStatusCode().value()).isEqualTo(409);
        assertThat(get("/api/v1/posts/" + archived.getId(), reader.getId()).getBody())
                .containsEntry("interactionsOpen", false);
    }

    // ------------------------------------------------------------ RF26 · comentar (caixa de mensagens)

    @Test
    void commentsBoxAddsListsAndLetsWriterOrPostOwnerDelete() {
        String box = "/api/v1/posts/" + published.getId() + "/comments";

        ResponseEntity<Map> created = send(HttpMethod.POST, box, reader.getId(), Map.of("body", "  Muito bom!  "));
        assertThat(created.getStatusCode().value()).isEqualTo(201);
        assertThat(created.getBody()).containsEntry("comments", 1);
        Map<String, Object> comment = map(created.getBody(), "comment");
        assertThat(comment).containsEntry("body", "Muito bom!").containsEntry("canDelete", true);
        assertThat(map(comment, "author")).containsEntry("name", "Ana Ribeiro");
        Number commentId = (Number) comment.get("id");

        send(HttpMethod.POST, box, author.getId(), Map.of("body", "Obrigado!"));
        assertThat(send(HttpMethod.POST, box, reader.getId(), Map.of("body", "   ")).getStatusCode().value())
                .isEqualTo(400);

        Map<String, Object> page = get(box + "?limit=1", null).getBody();
        assertThat(page).containsEntry("total", 2);
        assertThat(list(page, "items")).extracting(i -> i.get("body")).containsExactly("Muito bom!");
        assertThat(list(page, "items").getFirst()).containsEntry("canDelete", false);
        Map<String, Object> next = get(box + "?after=" + page.get("nextAfter"), null).getBody();
        assertThat(list(next, "items")).extracting(i -> i.get("body")).containsExactly("Obrigado!");

        UserControlList stranger = tx.execute(s -> users.saveAndFlush(
                activeUser("Outro", "outro@example.com", UserCategoryEnum.AZUL)));
        emails.put(stranger.getId(), stranger.getEmail());
        assertThat(send(HttpMethod.DELETE, box + "/" + commentId, stranger.getId(), null).getStatusCode().value())
                .isEqualTo(403);
        assertThat(send(HttpMethod.DELETE, box + "/" + commentId, author.getId(), null).getStatusCode().value())
                .isEqualTo(204);
        assertThat(map(get("/api/v1/posts/" + published.getId(), null).getBody(), "counts"))
                .containsEntry("comments", 1);
    }

    // ------------------------------------------------------------ RF26 · compartilhar

    @Test
    void shareReturnsLinkAndCountsEachUserChannelOnce() {
        String shares = "/api/v1/posts/" + published.getId() + "/shares";

        Map<String, Object> first = send(HttpMethod.POST, shares, reader.getId(), Map.of("channel", "WHATSAPP")).getBody();
        assertThat(first).containsEntry("shares", 1).containsEntry("counted", true)
                .containsEntry("shareUrl", "http://localhost:3000/p/" + published.getId());
        assertThat(send(HttpMethod.POST, shares, reader.getId(), Map.of("channel", "WHATSAPP")).getBody())
                .containsEntry("shares", 1).containsEntry("counted", false);
        assertThat(send(HttpMethod.POST, shares, reader.getId(), Map.of("channel", "COPY_LINK")).getBody())
                .containsEntry("shares", 2);
        assertThat(send(HttpMethod.POST, shares, reader.getId(), Map.of("channel", "POMBO")).getStatusCode().value())
                .isEqualTo(400);
    }

    // ------------------------------------------------------------ RF23 · eliminação apaga as interações

    @Test
    void lgpdErasureRemovesContentAndFixesOtherPostsCounters() {
        String base = "/api/v1/posts/" + published.getId();
        send(HttpMethod.PUT, base + "/like", reader.getId(), null);
        send(HttpMethod.PUT, base + "/save", reader.getId(), null);
        send(HttpMethod.POST, base + "/comments", reader.getId(), Map.of("body", "comentário pessoal"));
        send(HttpMethod.POST, base + "/shares", reader.getId(), Map.of("channel", "X"));
        Post readersPost = newPost(reader, "Post da Ana", p -> {
            p.setMediaObjectKey("posts/ana.jpg");
            p.setBackground(Map.of("v", 1, "auraPlusId", "brasa"));     // moldura do RF28 também some
            p.publish();
        });

        PostContentEraser.ErasureReport report = eraser.eraseContentOf(reader.getId());

        assertThat(report.postsRemoved()).isEqualTo(1);
        assertThat(report.commentsRemoved()).isEqualTo(1);
        assertThat(report.reactionsDeleted()).isEqualTo(2);
        assertThat(report.sharesAnonymized()).isEqualTo(1);
        assertThat(report.mediaKeysToDelete()).containsExactly("posts/ana.jpg");

        Map<String, Object> counts = map(get(base, null).getBody(), "counts");
        assertThat(counts).containsEntry("likes", 0).containsEntry("comments", 0).containsEntry("shares", 1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM post_comment WHERE body IS NOT NULL AND author_user_id = ?",
                Integer.class, reader.getId())).isZero();
        assertThat(get("/api/v1/posts/" + readersPost.getId(), null).getStatusCode().value()).isEqualTo(404);
        assertThat(jdbc.queryForObject("SELECT background IS NULL FROM post WHERE id = ?", Boolean.class,
                readersPost.getId())).isTrue();

        PostContentEraser.ErasureReport again = eraser.eraseContentOf(reader.getId());
        assertThat(again.postsRemoved() + again.commentsRemoved() + again.reactionsDeleted()).isZero();
    }

    // ------------------------------------------------------------ apoio

    private UserControlList activeUser(String name, String email, UserCategoryEnum category) {
        UserControlList user = new UserControlList(name, email, passwords.encode(PASSWORD), category);
        user.activate();
        return user;
    }

    private Post newPost(UserControlList owner, String title, Consumer<Post> setup) {
        Post post = new Post(owner, FeedType.POST, MediaType.TEXT, title);
        setup.accept(post);
        return tx.execute(s -> posts.saveAndFlush(post));
    }

    private ResponseEntity<Map> get(String path, Long viewerId) {
        return send(HttpMethod.GET, path, viewerId, null);
    }

    private ResponseEntity<Map> send(HttpMethod method, String path, Long viewerId, Object body) {
        ApiClient browser = viewerId == null ? new ApiClient(port) : browsers.computeIfAbsent(viewerId, id -> {
            ApiClient b = new ApiClient(port);
            assertThat(b.login(emails.get(id), PASSWORD).getStatusCode().value()).isEqualTo(200);
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
