package com.orangesocial.domain.model;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PostDomainTest {

    private static Post post(long authorId) {
        UserControlList author = new UserControlList("Ana", "ana@example.com", "hash", UserCategoryEnum.AMARELO);
        ReflectionTestUtils.setField(author, "id", authorId);
        return new Post(author, FeedType.POST, MediaType.VIDEO, "Título");
    }

    @Test
    void newPostCopiesAuthorCategoryAndStartsAsDraftVisibleOnlyToAuthor() {
        Post post = post(7L);

        assertThat(post.getAuthorUserType()).isEqualTo(UserCategoryEnum.AMARELO);
        assertThat(post.getStatus()).isEqualTo(PostStatus.DRAFT);
        assertThat(post.isNew()).isTrue();
        assertThat(post.isVisibleTo(7L)).isTrue();
        assertThat(post.isVisibleTo(8L)).isFalse();
        assertThat(post.isVisibleTo(null)).isFalse();
        assertThat(post.acceptsInteractions()).isFalse();
    }

    @Test
    void publishedAcceptsInteractionsArchivedIsVisibleButClosed() {
        Post post = post(7L);
        post.publish();
        assertThat(post.isVisibleTo(null)).isTrue();
        assertThat(post.acceptsInteractions()).isTrue();

        post.archive();
        assertThat(post.isVisibleTo(null)).isTrue();
        assertThat(post.acceptsInteractions()).isFalse();
    }

    @Test
    void removeWipesContentAndIsTerminal() {
        Post post = post(7L);
        post.setBody("texto");
        post.setMediaObjectKey("posts/x.mp4");
        post.setCity("Curitiba");
        post.publish();

        post.remove();

        assertThat(post.getTitle()).isEqualTo(Post.REMOVED_TITLE);
        assertThat(post.getBody()).isNull();
        assertThat(post.getMediaObjectKey()).isNull();
        assertThat(post.getCity()).isNull();
        assertThat(post.getRemovedAt()).isNotNull();
        assertThat(post.isVisibleTo(7L)).isFalse();
        assertThatThrownBy(post::publish).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void commentIsTrimmedValidatedAndRemovableByWriterOrPostOwner() {
        Post post = post(7L);
        UUID postId = post.getId();

        PostComment comment = new PostComment(postId, 9L, "  Ótimo post!  ");
        assertThat(comment.getBody()).isEqualTo("Ótimo post!");
        assertThat(comment.canBeRemovedBy(9L, post)).isTrue();
        assertThat(comment.canBeRemovedBy(7L, post)).isTrue();
        assertThat(comment.canBeRemovedBy(10L, post)).isFalse();

        comment.remove();
        assertThat(comment.getBody()).isNull();
        assertThat(comment.isVisible()).isFalse();

        assertThatThrownBy(() -> new PostComment(postId, 9L, "   ")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new PostComment(postId, 9L, "x".repeat(PostComment.MAX_LENGTH + 1)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void uuidV7HasVersionVariantAndSortsByTime() {
        UUID earlier = UuidV7.at(Instant.parse("2026-10-17T12:00:00Z"));
        UUID later = UuidV7.at(Instant.parse("2026-10-17T12:00:01Z"));

        assertThat(earlier.version()).isEqualTo(7);
        assertThat(earlier.variant()).isEqualTo(2);
        assertThat(earlier.getMostSignificantBits() >>> 16).isEqualTo(Instant.parse("2026-10-17T12:00:00Z").toEpochMilli());
        assertThat(earlier.toString()).isLessThan(later.toString());
    }
}
