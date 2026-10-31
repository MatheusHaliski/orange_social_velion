package com.orangesocial.application.post;

import com.orangesocial.application.background.BackgroundService.BackgroundView;

import com.orangesocial.domain.model.AgeRating;
import com.orangesocial.domain.model.FeedType;
import com.orangesocial.domain.model.MediaType;
import com.orangesocial.domain.model.PostStatus;
import com.orangesocial.domain.model.ShareChannel;
import com.orangesocial.domain.model.UserCategoryEnum;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Respostas da API de posts (RF24, RF25, RF26). Datas sempre em ISO-8601 UTC: o cliente mostra
 * o tempo relativo no card ("3 min") e a data absoluta no fuso do usuário no detalhe e no tooltip.
 */
public final class PostViews {

    private PostViews() {
    }

    /** Cor nunca é o único sinal: o cliente desenha o glifo pelo {@code code} e mostra o {@code label}. */
    public record CategoryView(String code, String label, String color) {
        static CategoryView of(UserCategoryEnum category) {
            return new CategoryView(category.name(), category.getLabel(), category.getHexColor());
        }
    }

    /**
     * Dono da publicação. {@code profilePath} é o destino do toque na foto ou no nome (RF25);
     * fica {@code null} quando a conta foi eliminada (LGPD) ou suspensa — o nome vira texto comum.
     */
    public record AuthorView(Long id, String name, CategoryView category, String avatarUrl,
                             String profilePath, boolean available) {
    }

    public record CountersView(long likes, long comments, long shares, long views) {
    }

    /** Estado dos botões para quem está vendo; tudo {@code false} para visitante anônimo. */
    public record ViewerStateView(boolean liked, boolean saved, boolean isAuthor) {
        static final ViewerStateView ANONYMOUS = new ViewerStateView(false, false, false);
    }

    /** Modal de detalhe (RF24): todos os dados do post; {@code background} = moldura resolvida (RF28) ou {@code null}. */
    public record PostDetailView(UUID id, FeedType feed, MediaType mediaType, String title, String subtitle,
                                 String body, String mediaUrl, Integer durationSeconds, AgeRating ageRating,
                                 String ageRatingLabel, PostStatus status, String country, String city,
                                 Instant publishedAt, AuthorView author, CountersView counts,
                                 ViewerStateView viewer, boolean interactionsOpen, String shareUrl,
                                 BackgroundView background) {
    }

    /** Card do feed: sem texto corrido (DESIGN_SYSTEM.md §6), o resto igual ao detalhe. */
    public record PostCardView(UUID id, FeedType feed, MediaType mediaType, String title, String subtitle,
                               String mediaUrl, Integer durationSeconds, AgeRating ageRating,
                               String ageRatingLabel, PostStatus status, Instant publishedAt, AuthorView author,
                               CountersView counts, ViewerStateView viewer, String detailPath,
                               BackgroundView background) {
    }

    public record FeedPageView(List<PostCardView> items, String nextCursor) {
    }

    /**
     * Perfil público (RF25). Minimização (LGPD Art. 6º, III): só nome, categoria, foto e datas;
     * cidade, e-mail, telefone e demais campos do cadastro nunca saem aqui.
     */
    public record PublicProfileView(Long id, String name, CategoryView category, String avatarUrl,
                                    Instant memberSince, long postCount, String postsPath, String shareUrl) {
    }

    public record CommentView(Long id, AuthorView author, String body, Instant createdAt, boolean canDelete) {
    }

    /** {@code nextAfter} vai no parâmetro {@code after} da próxima página; {@code null} = fim. */
    public record CommentPageView(List<CommentView> items, Long nextAfter, long total) {
    }

    public record CommentCreatedView(CommentView comment, long comments) {
    }

    public record LikeStateView(boolean liked, long likes) {
    }

    public record SaveStateView(boolean saved) {
    }

    /** {@code counted} = primeira vez deste usuário neste canal (só então o número sobe). */
    public record ShareResultView(String shareUrl, ShareChannel channel, long shares, boolean counted) {
    }
}
