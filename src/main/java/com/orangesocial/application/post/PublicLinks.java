package com.orangesocial.application.post;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.UUID;

/** Monta as URLs públicas: link compartilhável do post, caminhos da API e mídia no S3/CDN. */
@Component
public class PublicLinks {

    private final String publicBaseUrl;
    private final String mediaBaseUrl;

    public PublicLinks(@Value("${orange-social.public-base-url}") String publicBaseUrl,
                       @Value("${orange-social.storage.public-url}") String mediaBaseUrl) {
        this.publicBaseUrl = stripTrailingSlash(publicBaseUrl);
        this.mediaBaseUrl = stripTrailingSlash(mediaBaseUrl);
    }

    /** Link que vai para fora do app (WhatsApp, e-mail...): sem rastreamento de quem compartilhou. */
    public String shareUrl(UUID postId) {
        return publicBaseUrl + "/p/" + postId;
    }

    /** Link do perfil que vai para fora do app: a rota {@code /u/{id}} do app web, também sem rastreamento. */
    public String profileShareUrl(long userId) {
        return publicBaseUrl + "/u/" + userId;
    }

    public String postPath(UUID postId) {
        return "/api/v1/posts/" + postId;
    }

    public String profilePath(Long userId) {
        return "/api/v1/users/" + userId + "/profile";
    }

    public String userPostsPath(Long userId) {
        return "/api/v1/users/" + userId + "/posts";
    }

    public String mediaUrl(String objectKey) {
        return objectKey == null ? null : mediaBaseUrl + "/" + objectKey;
    }

    private static String stripTrailingSlash(String url) {
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
