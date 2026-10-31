package com.orangesocial.api;

import com.orangesocial.application.background.BackgroundCatalog.CatalogView;
import com.orangesocial.application.background.BackgroundService;
import com.orangesocial.application.background.BackgroundService.Recommendation;
import com.orangesocial.domain.model.FeedType;
import com.orangesocial.domain.model.MediaType;
import com.orangesocial.domain.model.UserCategoryEnum;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.WebRequest;

import java.time.Duration;
import java.util.List;

/**
 * Catálogo público do Background Studio (RF28). A ETag junta a versão do catálogo e a cartela do dia, então o
 * cliente revalida barato ({@code 304}) e pega a cartela nova quando a data vira em São Paulo.
 */
@RestController
@RequestMapping("/api/v1/backgrounds")
public class BackgroundController {

    private final BackgroundService backgrounds;

    public BackgroundController(BackgroundService backgrounds) {
        this.backgrounds = backgrounds;
    }

    @GetMapping("/catalog")
    public ResponseEntity<CatalogView> catalog(WebRequest request) {
        CatalogView view = backgrounds.catalog();
        String etag = "\"" + view.version() + "-" + view.activeSeasonId() + "\"";
        if (request.checkNotModified(etag)) {
            return null;
        }
        return ResponseEntity.ok()
                .eTag(etag)
                .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePublic())
                .body(view);
    }

    @GetMapping("/recommendations")
    public List<Recommendation> recommendations(@RequestParam UserCategoryEnum category,
                                                @RequestParam(defaultValue = "POST") FeedType feed,
                                                @RequestParam(defaultValue = "TEXT") MediaType media) {
        return backgrounds.recommend(category, feed, media);
    }
}
