package com.orangesocial.infrastructure.persistence.postgres;

import com.orangesocial.domain.model.CommentStatus;
import com.orangesocial.domain.model.PostComment;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface PostCommentRepository extends JpaRepository<PostComment, Long> {

    /** Caixa de mensagens: mais antigos primeiro, paginação por id crescente. */
    List<PostComment> findByPostIdAndStatusAndIdGreaterThanOrderByIdAsc(
            UUID postId, CommentStatus status, long afterId, Limit limit);

    /**
     * Apaga o comentário só se ele ainda estiver visível. Duas exclusões ao mesmo tempo (quem escreveu e o dono do
     * post): a segunda espera a trava da linha, relê o WHERE e volta 0, então o contador desce uma vez só (RF26).
     */
    @Modifying
    @Query(value = """
            UPDATE post_comment SET status = 'REMOVED', body = NULL, removed_at = now()
            WHERE id = :commentId AND status = 'VISIBLE'
            """, nativeQuery = true)
    int removeIfVisible(long commentId);

    // ------------------------------------------------------------ eliminação LGPD (RF23)

    @Modifying
    @Query(value = """
            UPDATE post p SET comment_count = p.comment_count - c.n
            FROM (SELECT post_id, count(*) AS n FROM post_comment
                  WHERE author_user_id = :userId AND status = 'VISIBLE' GROUP BY post_id) c
            WHERE p.id = c.post_id
            """, nativeQuery = true)
    int discountCommentsOf(Long userId);

    @Modifying
    @Query(value = """
            UPDATE post_comment SET status = 'REMOVED', body = NULL, removed_at = now()
            WHERE author_user_id = :userId AND status = 'VISIBLE'
            """, nativeQuery = true)
    int removeAllCommentsOf(Long userId);
}
