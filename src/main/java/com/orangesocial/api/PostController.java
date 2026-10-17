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
import jakarta.servlet.http.HttpServletRequest;
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
    public PostDetailView get(@PathVariable UUID postId, HttpServletRequest request) {
        return queries.getPost(postId, viewer.viewerId(request));
    }

    @PutMapping("/like")
    public LikeStateView like(@PathVariable UUID postId, HttpServletRequest request) {
        return interactions.like(postId, viewer.requireViewer(request));
    }

    @DeleteMapping("/like")
    public LikeStateView unlike(@PathVariable UUID postId, HttpServletRequest request) {
        return interactions.unlike(postId, viewer.requireViewer(request));
    }

    @PutMapping("/save")
    public SaveStateView save(@PathVariable UUID postId, HttpServletRequest request) {
        return interactions.save(postId, viewer.requireViewer(request));
    }

    @DeleteMapping("/save")
    public SaveStateView unsave(@PathVariable UUID postId, HttpServletRequest request) {
        return interactions.unsave(postId, viewer.requireViewer(request));
    }

    @GetMapping("/comments")
    public CommentPageView comments(@PathVariable UUID postId,
                                    @RequestParam(defaultValue = "0") long after,
                                    @RequestParam(defaultValue = "20") int limit,
                                    HttpServletRequest request) {
        return interactions.listComments(postId, after, limit, viewer.viewerId(request));
    }

    @PostMapping("/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public CommentCreatedView comment(@PathVariable UUID postId, @Valid @RequestBody NewComment body,
                                      HttpServletRequest request) {
        return interactions.addComment(postId, viewer.requireViewer(request), body.body());
    }

    @DeleteMapping("/comments/{commentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteComment(@PathVariable UUID postId, @PathVariable long commentId, HttpServletRequest request) {
        interactions.removeComment(postId, commentId, viewer.requireViewer(request));
    }

    @PostMapping("/shares")
    public ShareResultView share(@PathVariable UUID postId, @Valid @RequestBody NewShare body,
                                 HttpServletRequest request) {
        return interactions.share(postId, viewer.requireViewer(request), body.channel());
    }

    public record NewComment(@NotBlank @Size(max = PostComment.MAX_LENGTH) String body) {
    }

    public record NewShare(@NotNull ShareChannel channel) {
    }
}
