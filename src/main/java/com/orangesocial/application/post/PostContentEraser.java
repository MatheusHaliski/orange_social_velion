package com.orangesocial.application.post;

import com.orangesocial.infrastructure.persistence.postgres.PostCommentRepository;
import com.orangesocial.infrastructure.persistence.postgres.PostRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Passo "posts e interações" da saga de eliminação (RF23 · LGPD Art. 18, VI), executado antes da
 * anonimização do {@code VSusercontrolist}. Idempotente: rodar de novo não muda nada.
 *
 * <ul>
 *   <li>curtidas do titular saem e os contadores dos posts de terceiros descem;</li>
 *   <li>comentários do titular têm o texto apagado e os contadores descem;</li>
 *   <li>compartilhamentos perdem o vínculo com o titular, mas o total agregado (não pessoal) fica;</li>
 *   <li>posts do titular viram {@code REMOVED} com o conteúdo apagado; as chaves S3 voltam para a
 *       saga apagar os objetos (o banco perde a referência na mesma transação).</li>
 * </ul>
 */
@Service
public class PostContentEraser {

    private final PostRepository posts;
    private final PostCommentRepository comments;

    public PostContentEraser(PostRepository posts, PostCommentRepository comments) {
        this.posts = posts;
        this.comments = comments;
    }

    @Transactional
    public ErasureReport eraseContentOf(Long userId) {
        List<String> mediaKeys = posts.findMediaKeysByAuthor(userId);

        posts.discountLikesOf(userId);
        int reactions = posts.deleteReactionsOf(userId);

        comments.discountCommentsOf(userId);
        int removedComments = comments.removeAllCommentsOf(userId);

        int shares = posts.anonymizeSharesOf(userId);
        int removedPosts = posts.removeAllPostsOf(userId);

        return new ErasureReport(removedPosts, removedComments, reactions, shares, mediaKeys);
    }

    /** Comprovante do passo, gravado no recibo da saga (sem conteúdo, só contagens e chaves). */
    public record ErasureReport(int postsRemoved, int commentsRemoved, int reactionsDeleted,
                                int sharesAnonymized, List<String> mediaKeysToDelete) {
    }
}
