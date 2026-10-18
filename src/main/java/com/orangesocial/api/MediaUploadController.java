package com.orangesocial.api;

import com.orangesocial.application.post.PostMediaService;
import com.orangesocial.application.post.PostMediaService.UploadTicket;
import com.orangesocial.domain.model.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Envio de foto direto ao bucket (RF29): a API só assina a URL; o arquivo não passa por aqui. Depois do {@code PUT},
 * o app publica com {@code "mediaType": "IMAGE"} e a chave recebida. Exige sessão e {@code X-XSRF-TOKEN} (RF27).
 */
@RestController
@RequestMapping("/api/v1/media")
public class MediaUploadController {

    private final PostMediaService media;
    private final ViewerResolver viewer;

    public MediaUploadController(PostMediaService media, ViewerResolver viewer) {
        this.media = media;
        this.viewer = viewer;
    }

    @PostMapping("/uploads")
    @ResponseStatus(HttpStatus.CREATED)
    public UploadTicket requestUpload(@RequestBody UploadRequest body) {
        return media.requestUpload(viewer.requireViewer(), body.kind(), body.contentType(), body.sizeBytes());
    }

    public record UploadRequest(MediaType kind, String contentType, Long sizeBytes) {
    }
}
