package com.orangesocial.api;

import com.orangesocial.application.post.PostPublishingService;
import com.orangesocial.application.post.PostPublishingService.NewPost;
import com.orangesocial.application.post.PostViews.PostDetailView;
import com.orangesocial.domain.model.AgeRating;
import com.orangesocial.domain.model.FeedType;
import com.orangesocial.domain.model.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/**
 * Publicar, editar, arquivar, restaurar e apagar o próprio post (RF29), com a moldura do Background Studio (RF28).
 * Toda escrita exige sessão e {@code X-XSRF-TOKEN} (RF27).
 */
@RestController
@RequestMapping("/api/v1/posts")
public class PostPublishingController {

    private final PostPublishingService publishing;
    private final ViewerResolver viewer;

    public PostPublishingController(PostPublishingService publishing, ViewerResolver viewer) {
        this.publishing = publishing;
        this.viewer = viewer;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PostDetailView create(@RequestBody NewPostRequest body) {
        return publishing.create(viewer.requireViewer(), new NewPost(body.feed(), body.mediaType(), body.title(),
                body.subtitle(), body.body(), body.ageRating(), body.country(), body.city(), body.background(),
                body.mediaObjectKey()));
    }

    /** Chave ausente mantém o valor; {@code "background": null} volta à moldura padrão. */
    @PatchMapping("/{postId}")
    public PostDetailView update(@PathVariable UUID postId, @RequestBody Map<String, Object> patch) {
        return publishing.update(viewer.requireViewer(), postId, patch);
    }

    @PostMapping("/{postId}/archive")
    public PostDetailView archive(@PathVariable UUID postId) {
        return publishing.archive(viewer.requireViewer(), postId);
    }

    @PostMapping("/{postId}/restore")
    public PostDetailView restore(@PathVariable UUID postId) {
        return publishing.restore(viewer.requireViewer(), postId);
    }

    @DeleteMapping("/{postId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@PathVariable UUID postId) {
        publishing.remove(viewer.requireViewer(), postId);
    }

    public record NewPostRequest(FeedType feed, MediaType mediaType, String title, String subtitle, String body,
                                 AgeRating ageRating, String country, String city, Map<String, Object> background,
                                 String mediaObjectKey) {
    }
}
