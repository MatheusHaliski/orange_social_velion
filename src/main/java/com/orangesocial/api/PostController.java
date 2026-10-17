package com.orangesocial.api;

import com.orangesocial.application.post.PostInteractionService;
import com.orangesocial.application.post.PostQueryService;
import com.orangesocial.application.post.PostViews.CommentCreatedView;
import com.orangesocial.application.post.PostViews.CommentPageView;
import com.orangesocial.application.post.PostViews.LikeStateView;
import com.orangesocial.application.post.PostViews.PostDetailView;
import com.orangesocial.application.post.PostViews.SaveStateView;
import com.orangesocial.application.post.PostViews.ShareResultView;
import com.orangesocial.domain.model.PostComment;
import com.orangesocial.domain.model.ShareChannel;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * RF24 (detalhe do post no modal) e RF26 (curtir, comentar, compartilhar, salvar).
 * PUT/DELETE em like e save são idempotentes: o cliente pode repetir sem inflar o contador.
 */
@RestController
@RequestMapping("/api/v1/posts/{postId}")
public class PostController {

    private final PostQueryService queries;
    private final PostInteractionService interactions;
    private final ViewerResolver viewer;

    public PostController(PostQueryService queries, PostInteractionService interactions, ViewerResolver viewer) {
        this.queries = queries;
        this.interactions = interactions;
        this.viewer = viewer;
    }

    @GetMapping
    public PostDetailView get(@PathVariable UUID postId) {
        return queries.getPost(postId, viewer.viewerId());
    }

    @PutMapping("/like")
    public LikeStateView like(@PathVariable UUID postId) {
        return interactions.like(postId, viewer.requireViewer());
    }

    @DeleteMapping("/like")
    public LikeStateView unlike(@PathVariable UUID postId) {
        return interactions.unlike(postId, viewer.requireViewer());
    }

    @PutMapping("/save")
    public SaveStateView save(@PathVariable UUID postId) {
        return interactions.save(postId, viewer.requireViewer());
    }

    @DeleteMapping("/save")
    public SaveStateView unsave(@PathVariable UUID postId) {
        return interactions.unsave(postId, viewer.requireViewer());
    }

    @GetMapping("/comments")
    public CommentPageView comments(@PathVariable UUID postId,
                                    @RequestParam(defaultValue = "0") long after,
                                    @RequestParam(defaultValue = "20") int limit) {
        return interactions.listComments(postId, after, limit, viewer.viewerId());
    }

    @PostMapping("/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public CommentCreatedView comment(@PathVariable UUID postId, @Valid @RequestBody NewComment body) {
        return interactions.addComment(postId, viewer.requireViewer(), body.body());
    }

    @DeleteMapping("/comments/{commentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteComment(@PathVariable UUID postId, @PathVariable long commentId) {
        interactions.removeComment(postId, commentId, viewer.requireViewer());
    }

    @PostMapping("/shares")
    public ShareResultView share(@PathVariable UUID postId, @Valid @RequestBody NewShare body) {
        return interactions.share(postId, viewer.requireViewer(), body.channel());
    }

    public record NewComment(@NotBlank @Size(max = PostComment.MAX_LENGTH) String body) {
    }

    public record NewShare(@NotNull ShareChannel channel) {
    }
}
