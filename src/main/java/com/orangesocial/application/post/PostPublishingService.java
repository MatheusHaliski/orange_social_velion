package com.orangesocial.application.post;

import com.orangesocial.application.account.AgePolicy;
import com.orangesocial.application.background.BackgroundValidator;
import com.orangesocial.application.post.PostViews.PostDetailView;
import com.orangesocial.domain.model.AgeRating;
import com.orangesocial.domain.model.CategoryVerification;
import com.orangesocial.domain.model.FeedType;
import com.orangesocial.domain.model.MediaType;
import com.orangesocial.domain.model.Post;
import com.orangesocial.domain.model.PostStatus;
import com.orangesocial.domain.model.UserControlList;
import com.orangesocial.infrastructure.persistence.postgres.PostRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Publicação de post pelo autor (RF29, OS-23: texto e foto no Post Feed) e a moldura escolhida no Background Studio
 * (RF28). Quem publica precisa de conta ativa; instituição e banco, do selo verificado. A foto chega antes por URL
 * pré-assinada e é limpa aqui ({@link PostMediaService}); vídeo e áudio ficam para as próximas etapas.
 */
@Service
@Transactional
public class PostPublishingService {

    public static final int MAX_TITLE = 140;
    public static final int MAX_SUBTITLE = 280;
    public static final int MAX_BODY = 5000;
    static final Set<String> EDITABLE = Set.of("title", "subtitle", "body", "ageRating", "country", "city", "background");
    private static final Pattern COUNTRY = Pattern.compile("^[A-Z]{2}$");

    /** Pedido de criação; {@code background} chega como JSON livre e é validado pelo {@link BackgroundValidator}. */
    public record NewPost(FeedType feed, MediaType mediaType, String title, String subtitle, String body,
                          AgeRating ageRating, String country, String city, Object background,
                          String mediaObjectKey) {
    }

    private final PostRepository posts;
    private final AuthorDirectory authors;
    private final AgePolicy ages;
    private final BackgroundValidator backgrounds;
    private final PostQueryService queries;
    private final PostMediaService media;

    public PostPublishingService(PostRepository posts, AuthorDirectory authors, AgePolicy ages,
                                 BackgroundValidator backgrounds, PostQueryService queries, PostMediaService media) {
        this.posts = posts;
        this.authors = authors;
        this.ages = ages;
        this.backgrounds = backgrounds;
        this.queries = queries;
        this.media = media;
    }

    public PostDetailView create(long viewerId, NewPost cmd) {
        UserControlList author = requirePublisher(viewerId);
        FeedType feed = cmd.feed() == null ? FeedType.POST : cmd.feed();
        MediaType mediaType = cmd.mediaType() == null ? MediaType.TEXT : cmd.mediaType();
        String uploadKey = trim(cmd.mediaObjectKey());
        List<String> errors = new ArrayList<>();
        switch (feed) {
            case POST -> {
                switch (mediaType) {
                    case TEXT -> {
                        if (uploadKey != null) {
                            errors.add("Post de texto não leva mídia: use \"mediaType\": \"IMAGE\" para publicar a foto.");
                        }
                    }
                    case IMAGE -> {
                        if (uploadKey == null) {
                            errors.add("Envie a foto antes (POST /api/v1/media/uploads) e informe \"mediaObjectKey\".");
                        }
                    }
                    case VIDEO -> errors.add("Vídeo ainda não: falta o processamento que tira os metadados e gera o pôster.");
                    case AUDIO -> errors.add("Áudio vai para o Audio Feed, que ainda não está disponível (OS-24).");
                }
            }
            case AUDIO -> errors.add("O Audio Feed precisa de envio de áudio, que ainda não está disponível (OS-24).");
            case ALERT -> errors.add("O Alert Feed abre só para fontes verificadas, com área e validade do alerta (OS-25).");
            case PROFILE -> errors.add("O Profile Feed mostra perfis, não posts.");
        }
        Fields f = new Fields(trim(cmd.title()), trim(cmd.subtitle()), trim(cmd.body()),
                cmd.ageRating() == null ? AgeRating.LIVRE : cmd.ageRating(), upper(trim(cmd.country())), trim(cmd.city()));
        check(f, author, errors);
        Map<String, Object> background = validBackground(cmd.background(), feed, author, errors);
        if (!errors.isEmpty()) {
            throw new PostExceptions.Invalid(errors);
        }
        // a foto só é processada quando o resto do post já passou: limpar imagem custa mais que validar texto
        String mediaKey = mediaType == MediaType.IMAGE ? media.attachImage(author.getId(), uploadKey) : null;
        Post post = new Post(author, feed, mediaType, f.title());
        apply(post, f);
        post.setMediaObjectKey(mediaKey);
        post.setBackground(background);
        post.publish();
        posts.saveAndFlush(post);
        return queries.getPost(post.getId(), Optional.of(viewerId));
    }

    /** PATCH parcial: chave ausente mantém; {@code "background": null} volta à moldura padrão. */
    public PostDetailView update(long viewerId, UUID postId, Map<String, Object> patch) {
        Post post = ownPost(viewerId, postId);
        UserControlList author = requirePublisher(viewerId);
        List<String> errors = new ArrayList<>();
        for (String key : patch.keySet()) {
            if (!EDITABLE.contains(key)) {
                errors.add("Campo \"" + key + "\" não pode ser alterado por aqui.");
            }
        }
        Fields f = new Fields(
                patch.containsKey("title") ? trim(text(patch.get("title"), "title", errors)) : post.getTitle(),
                patch.containsKey("subtitle") ? trim(text(patch.get("subtitle"), "subtitle", errors)) : post.getSubtitle(),
                patch.containsKey("body") ? trim(text(patch.get("body"), "body", errors)) : post.getBody(),
                patch.containsKey("ageRating") ? rating(patch.get("ageRating"), errors) : post.getAgeRating(),
                patch.containsKey("country") ? upper(trim(text(patch.get("country"), "country", errors))) : post.getCountry(),
                patch.containsKey("city") ? trim(text(patch.get("city"), "city", errors)) : post.getCity());
        check(f, author, errors);
        Map<String, Object> background = patch.containsKey("background")
                ? validBackground(patch.get("background"), post.getFeedType(), author, errors)
                : post.getBackground();
        if (!errors.isEmpty()) {
            throw new PostExceptions.Invalid(errors);
        }
        apply(post, f);
        post.setBackground(background);
        posts.saveAndFlush(post);
        return queries.getPost(postId, Optional.of(viewerId));
    }

    public PostDetailView archive(long viewerId, UUID postId) {
        Post post = ownPost(viewerId, postId);
        if (post.getStatus() != PostStatus.PUBLISHED) {
            throw new PostExceptions.Conflict("Só posts publicados podem ser arquivados.");
        }
        post.archive();
        posts.saveAndFlush(post);
        return queries.getPost(postId, Optional.of(viewerId));
    }

    public PostDetailView restore(long viewerId, UUID postId) {
        Post post = ownPost(viewerId, postId);
        if (post.getStatus() != PostStatus.ARCHIVED) {
            throw new PostExceptions.Conflict("Só posts arquivados podem voltar ao feed.");
        }
        requirePublisher(viewerId);
        post.publish();
        posts.saveAndFlush(post);
        return queries.getPost(postId, Optional.of(viewerId));
    }

    /**
     * Apagar pelo autor: o conteúdo some (título vira "Conteúdo removido") e o post responde 404 para todos. A foto
     * sai do bucket depois do commit.
     */
    public void remove(long viewerId, UUID postId) {
        Post post = ownPost(viewerId, postId);
        String mediaKey = post.getMediaObjectKey();
        post.remove();
        posts.saveAndFlush(post);
        media.discard(mediaKey);
    }

    // ------------------------------------------------------------ regras

    private record Fields(String title, String subtitle, String body, AgeRating rating, String country, String city) {
    }

    /** Conta ativa e, para instituição e banco, selo conferido pela moderação (RF1, critério 3). */
    private UserControlList requirePublisher(long viewerId) {
        UserControlList user = authors.find(viewerId)
                .filter(AuthorDirectory::isPublic)
                .orElseThrow(() -> new PostExceptions.Forbidden(
                        "Sua conta precisa estar ativa para publicar. Confirme seu e-mail ou fale com o suporte."));
        if (user.getCategoryVerification() == CategoryVerification.PENDING
                || user.getCategoryVerification() == CategoryVerification.REJECTED) {
            throw new PostExceptions.Forbidden("Sua conta de " + user.getUserType().getLabel()
                    + " ainda está em verificação: você já pode ler e interagir, e publica depois do selo.");
        }
        return user;
    }

    /** Post de outra pessoa ou inexistente: 404 sem dizer qual (como no RF24). */
    private Post ownPost(long viewerId, UUID postId) {
        return posts.findById(postId)
                .filter(p -> p.getStatus() != PostStatus.REMOVED)
                .filter(p -> p.isAuthoredBy(viewerId))
                .orElseThrow(() -> new PostExceptions.NotFound("Post não encontrado."));
    }

    private void check(Fields f, UserControlList author, List<String> errors) {
        if (f.title() == null || f.title().isEmpty()) {
            errors.add("Dê um título ao post.");
        } else if (f.title().length() > MAX_TITLE) {
            errors.add("O título vai até " + MAX_TITLE + " caracteres.");
        }
        if (f.subtitle() != null && f.subtitle().length() > MAX_SUBTITLE) {
            errors.add("O subtítulo vai até " + MAX_SUBTITLE + " caracteres.");
        }
        if (f.body() != null && f.body().length() > MAX_BODY) {
            errors.add("O texto vai até " + MAX_BODY + " caracteres.");
        }
        if (f.country() != null && !COUNTRY.matcher(f.country()).matches()) {
            errors.add("País em duas letras (ISO 3166), ex.: BR.");
        }
        if (f.city() != null && f.city().length() > 120) {
            errors.add("Cidade com até 120 caracteres.");
        }
        if ((f.rating() == AgeRating.AGE_18 || f.rating() == AgeRating.SENSITIVE)
                && !ages.adult(author.getUserDateOfBirth())) {
            errors.add("Menores de 18 anos não publicam conteúdo 18+ ou sensível.");
        }
    }

    private Map<String, Object> validBackground(Object raw, FeedType feed, UserControlList author, List<String> errors) {
        try {
            return backgrounds.validate(raw, new BackgroundValidator.Context(feed,
                    ages.protectedMinor(author.getUserDateOfBirth())));
        } catch (PostExceptions.Invalid e) {
            errors.addAll(e.errors());
            return null;
        }
    }

    private static void apply(Post post, Fields f) {
        post.setTitle(f.title());
        post.setSubtitle(blankToNull(f.subtitle()));
        post.setBody(blankToNull(f.body()));
        post.setAgeRating(f.rating());
        post.setCountry(blankToNull(f.country()));
        post.setCity(blankToNull(f.city()));
    }

    private static String text(Object value, String field, List<String> errors) {
        if (value == null || value instanceof String) {
            return (String) value;
        }
        errors.add("\"" + field + "\" deve ser texto.");
        return null;
    }

    private static AgeRating rating(Object value, List<String> errors) {
        try {
            return value == null ? AgeRating.LIVRE : AgeRating.valueOf(String.valueOf(value));
        } catch (IllegalArgumentException e) {
            errors.add("Classificação inválida: use LIVRE, AGE_12, AGE_16, AGE_18 ou SENSITIVE.");
            return AgeRating.LIVRE;
        }
    }

    private static String trim(String s) {
        return s == null ? null : s.strip();
    }

    private static String upper(String s) {
        return s == null ? null : s.toUpperCase(Locale.ROOT);
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }
}
