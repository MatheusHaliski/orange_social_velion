package com.orangesocial.application.post;

import com.orangesocial.domain.model.FeedType;
import com.orangesocial.domain.model.MediaType;
import com.orangesocial.domain.model.Post;
import com.orangesocial.domain.model.UserCategoryEnum;
import com.orangesocial.domain.model.UserControlList;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FeedCursorTest {

    @Test
    void roundTripKeepsMicrosecondsAndId() {
        UserControlList author = new UserControlList("Ana", "ana@example.com", "hash", UserCategoryEnum.VERDE);
        ReflectionTestUtils.setField(author, "id", 1L);
        Post post = new Post(author, FeedType.POST, MediaType.TEXT, "t");
        Instant createdAt = Instant.parse("2026-10-17T12:34:56.123456Z");
        ReflectionTestUtils.setField(post, "createdAt", createdAt);

        PostQueryService.FeedCursor decoded = PostQueryService.FeedCursor.decode(PostQueryService.FeedCursor.encode(post));

        assertThat(decoded.createdAt()).isEqualTo(createdAt);
        assertThat(decoded.id()).isEqualTo(post.getId());
    }

    @Test
    void garbageCursorIsABadRequest() {
        assertThatThrownBy(() -> PostQueryService.FeedCursor.decode("não-é-cursor"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Cursor");
    }

    @Test
    void shareLinkCarriesNoTrackingAndPathsAreStable() {
        PublicLinks links = new PublicLinks("https://orange.example/", "https://cdn.example/media/");
        java.util.UUID id = java.util.UUID.fromString("0192f0c2-8a00-7000-8000-000000000001");

        assertThat(links.shareUrl(id)).isEqualTo("https://orange.example/p/" + id);
        assertThat(links.profilePath(42L)).isEqualTo("/api/v1/users/42/profile");
        assertThat(links.mediaUrl("users/42/avatar.webp")).isEqualTo("https://cdn.example/media/users/42/avatar.webp");
        assertThat(links.mediaUrl(null)).isNull();
    }
}
