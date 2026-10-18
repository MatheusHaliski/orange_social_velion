package com.orangesocial.application.post;

import com.orangesocial.application.background.BackgroundService;

import com.orangesocial.application.post.PostViews.AuthorView;
import com.orangesocial.application.post.PostViews.CategoryView;
import com.orangesocial.application.post.PostViews.CountersView;
import com.orangesocial.application.post.PostViews.FeedPageView;
import com.orangesocial.application.post.PostViews.PostCardView;
import com.orangesocial.application.post.PostViews.PostDetailView;
import com.orangesocial.application.post.PostViews.PublicProfileView;
import com.orangesocial.application.post.PostViews.ViewerStateView;
import com.orangesocial.domain.model.Post;
import com.orangesocial.domain.model.PostStatus;
import com.orangesocial.domain.model.ReactionKind;
import com.orangesocial.domain.model.UserControlList;
import com.orangesocial.infrastructure.persistence.postgres.PostRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Leitura: modal de detalhe do post (RF24) e perfil público com o feed do autor (RF25).
 * Post de autor suspenso, removido ou rascunho de terceiros responde 404 sem dizer o motivo.
 */
@Service
@Transactional(readOnly = true)
public class PostQueryService {

    static final int MAX_PAGE = 50;

    private final PostRepository posts;
    private final AuthorDirectory authors;
    private final PublicLinks links;
    private final BackgroundService backgrounds;

    public PostQueryService(PostRepository posts, AuthorDirectory authors, PublicLinks links,
                            BackgroundService backgrounds) {
        this.posts = posts;
        this.authors = authors;
        this.links = links;
        this.backgrounds = backgrounds;
    }

    // ------------------------------------------------------------ RF24 · detalhe

    public PostDetailView getPost(UUID postId, Optional<Long> viewerId) {
        Post post = posts.findById(postId)
                .filter(p -> p.isVisibleTo(viewerId.orElse(null)))
                .orElseThrow(() -> new PostExceptions.NotFound("Post não encontrado."));
        UserControlList author = authors.find(post.getAuthorUserId())
                .filter(a -> AuthorDirectory.isPublic(a) || post.isAuthoredBy(viewerId.orElse(null)))
                .orElseThrow(() -> new PostExceptions.NotFound("Post não encontrado."));

        ViewerStateView viewer = viewerId
                .map(id -> new ViewerStateView(
                        posts.existsReaction(postId, id, ReactionKind.LIKE.name()),
                        posts.existsReaction(postId, id, ReactionKind.SAVE.name()),
                        post.isAuthoredBy(id)))
                .orElse(ViewerStateView.ANONYMOUS);

        return new PostDetailView(post.getId(), post.getFeedType(), post.getMediaType(), post.getTitle(),
                post.getSubtitle(), post.getBody(), links.mediaUrl(post.getMediaObjectKey()),
                post.getDurationSeconds(), post.getAgeRating(), post.getAgeRating().getLabel(), post.getStatus(),
                post.getCountry(), post.getCity(), post.getCreatedAt(), authors.view(author), counters(post),
                viewer, post.acceptsInteractions(), links.shareUrl(post.getId()), backgrounds.resolve(post.getBackground()));
    }

    // ------------------------------------------------------------ RF25 · perfil público + feed do autor

    public PublicProfileView getProfile(Long userId) {
        UserControlList user = publicUser(userId);
        long postCount = posts.countByAuthorUserIdAndStatusIn(userId, PostStatus.PUBLIC);
        return new PublicProfileView(user.getId(), user.getName(), CategoryView.of(user.getUserType()),
                links.mediaUrl(user.getPhotoObjectKey()), user.getCreatedAt(), postCount,
                links.userPostsPath(user.getId()));
    }

    public FeedPageView authorFeed(Long userId, Optional<String> cursor, int limit, Optional<Long> viewerId) {
        UserControlList user = publicUser(userId);
        int size = Math.clamp(limit, 1, MAX_PAGE);

        // pede um a mais para saber se existe próxima página sem COUNT(*)
        List<Post> page = cursor.map(FeedCursor::decode)
                .map(c -> posts.findAuthorFeedBefore(userId, c.createdAt(), c.id(), size + 1))
                .orElseGet(() -> posts.findAuthorFeed(userId, size + 1));
        boolean hasMore = page.size() > size;
        List<Post> items = hasMore ? page.subList(0, size) : page;

        List<UUID> ids = items.stream().map(Post::getId).toList();
        Set<UUID> liked = reacted(viewerId, ReactionKind.LIKE, ids);
        Set<UUID> saved = reacted(viewerId, ReactionKind.SAVE, ids);

        AuthorView author = authors.view(user);
        List<PostCardView> cards = items.stream().map(p -> new PostCardView(p.getId(), p.getFeedType(),
                p.getMediaType(), p.getTitle(), p.getSubtitle(), links.mediaUrl(p.getMediaObjectKey()),
                p.getDurationSeconds(), p.getAgeRating(), p.getAgeRating().getLabel(), p.getStatus(),
                p.getCreatedAt(), author, counters(p),
                new ViewerStateView(liked.contains(p.getId()), saved.contains(p.getId()),
                        p.isAuthoredBy(viewerId.orElse(null))),
                links.postPath(p.getId()), backgrounds.resolve(p.getBackground()))).toList();

        String next = hasMore ? FeedCursor.encode(items.getLast()) : null;
        return new FeedPageView(cards, next);
    }

    private UserControlList publicUser(Long userId) {
        return authors.find(userId)
                .filter(AuthorDirectory::isPublic)
                .orElseThrow(() -> new PostExceptions.NotFound("Perfil não encontrado."));
    }

    /** Uma consulta por tipo de reação para a página inteira (estado dos botões nos cards). */
    private Set<UUID> reacted(Optional<Long> viewerId, ReactionKind kind, List<UUID> postIds) {
        if (viewerId.isEmpty() || postIds.isEmpty()) {
            return Set.of();
        }
        return new HashSet<>(posts.findReactedPostIds(viewerId.get(), kind.name(), postIds));
    }

    private static CountersView counters(Post post) {
        return new CountersView(post.getLikeCount(), post.getCommentCount(), post.getShareCount(),
                post.getViewCount());
    }

    /** Cursor opaco "micros-desde-epoch:uuid" em Base64 URL-safe. */
    record FeedCursor(Instant createdAt, UUID id) {

        static String encode(Post last) {
            long micros = ChronoUnit.MICROS.between(Instant.EPOCH, last.getCreatedAt());
            String raw = micros + ":" + last.getId();
            return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
        }

        static FeedCursor decode(String cursor) {
            try {
                String raw = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
                int sep = raw.indexOf(':');
                long micros = Long.parseLong(raw.substring(0, sep));
                return new FeedCursor(Instant.EPOCH.plus(micros, ChronoUnit.MICROS),
                        UUID.fromString(raw.substring(sep + 1)));
            } catch (RuntimeException e) {
                throw new IllegalArgumentException("Cursor de paginação inválido.", e);
            }
        }
    }
}
