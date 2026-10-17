package com.orangesocial.api;

import com.orangesocial.application.post.PostQueryService;
import com.orangesocial.application.post.PostViews.FeedPageView;
import com.orangesocial.application.post.PostViews.PublicProfileView;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;

/** RF25: destino do toque na foto ou no nome do autor — perfil público e o feed dele. */
@RestController
@RequestMapping("/api/v1/users/{userId}")
public class UserProfileController {

    private final PostQueryService queries;
    private final ViewerResolver viewer;

    public UserProfileController(PostQueryService queries, ViewerResolver viewer) {
        this.queries = queries;
        this.viewer = viewer;
    }

    @GetMapping("/profile")
    public PublicProfileView profile(@PathVariable Long userId) {
        return queries.getProfile(userId);
    }

    @GetMapping("/posts")
    public FeedPageView posts(@PathVariable Long userId,
                              @RequestParam Optional<String> cursor,
                              @RequestParam(defaultValue = "20") int limit,
                              HttpServletRequest request) {
        return queries.authorFeed(userId, cursor, limit, viewer.viewerId(request));
    }
}
