package com.orangesocial.api;

import com.orangesocial.application.media.MediaUploads;
import com.orangesocial.application.media.MediaUploads.UploadTicket;
import com.orangesocial.domain.model.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Envio de foto direto ao bucket (RF29, RF2): a API só assina a URL; o arquivo não passa por aqui. Depois do
 * {@code PUT}, o app usa a chave recebida no post ({@code "mediaType": "IMAGE"}) ou na foto de perfil
 * ({@code PUT /api/v1/me/photo}). Exige sessão e {@code X-XSRF-TOKEN} (RF27).
 */
@RestController
@RequestMapping("/api/v1/media")
public class MediaUploadController {

    private final MediaUploads media;
    private final ViewerResolver viewer;

    public MediaUploadController(MediaUploads media, ViewerResolver viewer) {
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
