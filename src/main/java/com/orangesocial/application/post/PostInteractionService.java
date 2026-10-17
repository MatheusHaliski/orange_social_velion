package com.orangesocial.application.post;

import com.orangesocial.application.post.PostViews.CommentCreatedView;
import com.orangesocial.application.post.PostViews.CommentPageView;
import com.orangesocial.application.post.PostViews.CommentView;
import com.orangesocial.application.post.PostViews.LikeStateView;
import com.orangesocial.application.post.PostViews.SaveStateView;
import com.orangesocial.application.post.PostViews.ShareResultView;
import com.orangesocial.domain.model.CommentStatus;
import com.orangesocial.domain.model.Post;
import com.orangesocial.domain.model.PostComment;
import com.orangesocial.domain.model.ReactionKind;
import com.orangesocial.domain.model.ShareChannel;
import com.orangesocial.domain.model.UserControlList;
import com.orangesocial.infrastructure.persistence.postgres.PostCommentRepository;
import com.orangesocial.infrastructure.persistence.postgres.PostRepository;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * RF26 · interações com contagem: curtir, comentar (caixa de mensagens), compartilhar e salvar.
 *
 * <p>Regra dos contadores: a linha de associação e o contador mudam na mesma transação, e o
 * contador só se move quando a linha realmente entrou ou saiu. Repetir "curtir" ou o mesmo
 * compartilhamento não altera o número (idempotente, seguro para retry do cliente).
 */
@Service
@Transactional
public class PostInteractionService {

    static final int MAX_COMMENTS_PAGE = 50;

    private final PostRepository posts;
    private final PostCommentRepository comments;
    private final AuthorDirectory authors;
    private final PublicLinks links;

    public PostInteractionService(PostRepository posts, PostCommentRepository comments,
                                  AuthorDirectory authors, PublicLinks links) {
        this.posts = posts;
        this.comments = comments;
        this.authors = authors;
        this.links = links;
    }

    // ------------------------------------------------------------ curtir

    public LikeStateView like(UUID postId, long viewerId) {
        Post post = openPost(postId, viewerId);
        if (posts.insertReaction(post.getId(), viewerId, ReactionKind.LIKE.name()) == 1) {
            posts.addToLikeCount(post.getId(), 1);
        }
        return new LikeStateView(true, posts.findCounters(post.getId()).getLikes());
    }

    /** Descurtir continua permitido em post arquivado: o usuário sempre pode desfazer o que fez. */
    public LikeStateView unlike(UUID postId, long viewerId) {
        requireActive(viewerId);
        Post post = visiblePost(postId, viewerId);
        if (posts.deleteReaction(post.getId(), viewerId, ReactionKind.LIKE.name()) == 1) {
            posts.addToLikeCount(post.getId(), -1);
        }
        return new LikeStateView(false, posts.findCounters(post.getId()).getLikes());
    }

    // ------------------------------------------------------------ salvar (privado, sem contador público)

    public SaveStateView save(UUID postId, long viewerId) {
        requireActive(viewerId);
        Post post = visiblePost(postId, viewerId);
        posts.insertReaction(post.getId(), viewerId, ReactionKind.SAVE.name());
        return new SaveStateView(true);
    }

    public SaveStateView unsave(UUID postId, long viewerId) {
        posts.deleteReaction(postId, viewerId, ReactionKind.SAVE.name());
        return new SaveStateView(false);
    }

    // ------------------------------------------------------------ comentar

    public CommentCreatedView addComment(UUID postId, long viewerId, String body) {
        Post post = openPost(postId, viewerId);
        PostComment comment = comments.saveAndFlush(new PostComment(post.getId(), viewerId, body));
        posts.addToCommentCount(post.getId(), 1);
        UserControlList author = authors.find(viewerId).orElseThrow();
        return new CommentCreatedView(new CommentView(comment.getId(), authors.view(author), comment.getBody(),
                comment.getCreatedAt(), true), posts.findCounters(post.getId()).getComments());
    }

    public void removeComment(UUID postId, long commentId, long viewerId) {
        requireActive(viewerId);
        Post post = visiblePost(postId, viewerId);
        PostComment comment = comments.findById(commentId)
                .filter(c -> c.getPostId().equals(postId) && c.isVisible())
                .orElseThrow(() -> new PostExceptions.NotFound("Comentário não encontrado."));
        if (!comment.canBeRemovedBy(viewerId, post)) {
            throw new PostExceptions.Forbidden("Só quem escreveu ou o dono do post pode apagar este comentário.");
        }
        comment.remove();
        posts.addToCommentCount(post.getId(), -1);
    }

    @Transactional(readOnly = true)
    public CommentPageView listComments(UUID postId, long afterId, int limit, Optional<Long> viewerId) {
        Post post = visiblePost(postId, viewerId.orElse(null));
        int size = Math.clamp(limit, 1, MAX_COMMENTS_PAGE);
        List<PostComment> page = comments.findByPostIdAndStatusAndIdGreaterThanOrderByIdAsc(
                postId, CommentStatus.VISIBLE, afterId, Limit.of(size + 1));
        boolean hasMore = page.size() > size;
        List<PostComment> items = hasMore ? page.subList(0, size) : page;

        Map<Long, UserControlList> byId = authors.findAll(items.stream().map(PostComment::getAuthorUserId).toList());
        List<CommentView> views = items.stream().map(c -> new CommentView(c.getId(),
                authors.view(byId.get(c.getAuthorUserId())), c.getBody(), c.getCreatedAt(),
                viewerId.map(v -> c.canBeRemovedBy(v, post)).orElse(false))).toList();

        return new CommentPageView(views, hasMore ? items.getLast().getId() : null,
                posts.findCounters(postId).getComments());
    }

    // ------------------------------------------------------------ compartilhar

    public ShareResultView share(UUID postId, long viewerId, ShareChannel channel) {
        Post post = openPost(postId, viewerId);
        boolean counted = posts.insertShare(post.getId(), viewerId, channel.name()) == 1;
        if (counted) {
            posts.addToShareCount(post.getId(), 1);
        }
        return new ShareResultView(links.shareUrl(post.getId()), channel,
                posts.findCounters(post.getId()).getShares(), counted);
    }

    // ------------------------------------------------------------ regras comuns

    /** Post que o usuário (ou visitante, se {@code null}) pode ver — mesma regra do detalhe (RF24). */
    private Post visiblePost(UUID postId, Long viewerId) {
        Post post = posts.findById(postId)
                .filter(p -> p.isVisibleTo(viewerId))
                .orElseThrow(() -> new PostExceptions.NotFound("Post não encontrado."));
        authors.find(post.getAuthorUserId())
                .filter(a -> AuthorDirectory.isPublic(a) || post.isAuthoredBy(viewerId))
                .orElseThrow(() -> new PostExceptions.NotFound("Post não encontrado."));
        return post;
    }

    /** Para escrever: conta ativa, post visível e publicado (arquivado responde 409). */
    private Post openPost(UUID postId, long viewerId) {
        requireActive(viewerId);
        Post post = visiblePost(postId, viewerId);
        if (!post.acceptsInteractions()) {
            throw new PostExceptions.InteractionsClosed();
        }
        return post;
    }

    private void requireActive(long viewerId) {
        authors.find(viewerId)
                .filter(AuthorDirectory::isPublic)
                .orElseThrow(() -> new PostExceptions.Forbidden(
                        "Sua conta precisa estar ativa para interagir. Confirme seu e-mail ou fale com o suporte."));
    }
}
