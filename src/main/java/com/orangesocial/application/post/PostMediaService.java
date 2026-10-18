package com.orangesocial.application.post;

import com.orangesocial.application.media.ImageSanitizer;
import com.orangesocial.application.media.ImageSanitizer.CleanImage;
import com.orangesocial.application.media.MediaJanitor;
import com.orangesocial.application.media.MediaStorage;
import com.orangesocial.application.media.MediaStorage.PresignedUpload;
import com.orangesocial.application.media.MediaStorage.StoredObject;
import com.orangesocial.domain.model.MediaType;
import com.orangesocial.domain.model.UuidV7;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Foto do post (RF29 · OS-23, 2ª parte) em dois tempos:
 *
 * <ol>
 *   <li>{@link #requestUpload}: o autor pede uma URL pré-assinada e envia o arquivo direto ao bucket, em
 *       {@code uploads/{autor}/…}, área privada que expira;</li>
 *   <li>{@link #attachImage}: ao publicar, a API confere dono, existência, tipo e tamanho, limpa a foto
 *       ({@link ImageSanitizer}: sem EXIF/GPS) e grava a versão pública em {@code posts/…}. O original sai do bucket
 *       depois do commit; se a publicação falhar, a versão pública sai no rollback.</li>
 * </ol>
 */
@Service
public class PostMediaService {

    public static final long MAX_IMAGE_BYTES = 10L * 1024 * 1024;
    static final Duration UPLOAD_TTL = Duration.ofMinutes(15);
    static final Map<String, String> IMAGE_TYPES = Map.of("image/jpeg", "jpg", "image/png", "png");
    private static final Pattern UPLOAD_KEY = Pattern.compile("^uploads/(\\d+)/[0-9a-f-]{36}\\.(jpg|png)$");
    static final String UPLOAD_NOT_FOUND = "A foto não chegou ou o envio expirou. Envie a foto de novo.";

    /** O que o app precisa para enviar o arquivo e, depois, citar a chave no {@code POST /api/v1/posts}. */
    public record UploadTicket(String objectKey, String uploadUrl, String method, Map<String, String> headers,
                               Instant expiresAt, long maxBytes) {
    }

    private final MediaStorage storage;
    private final MediaJanitor janitor;
    private final AuthorDirectory authors;

    public PostMediaService(MediaStorage storage, MediaJanitor janitor, AuthorDirectory authors) {
        this.storage = storage;
        this.janitor = janitor;
        this.authors = authors;
    }

    public UploadTicket requestUpload(long viewerId, MediaType kind, String contentType, Long sizeBytes) {
        authors.find(viewerId).filter(AuthorDirectory::isPublic).orElseThrow(() -> new PostExceptions.Forbidden(
                "Sua conta precisa estar ativa para enviar fotos. Confirme seu e-mail ou fale com o suporte."));
        List<String> errors = new ArrayList<>();
        if (kind == null || kind == MediaType.TEXT) {
            errors.add("Diga o tipo de mídia: IMAGE.");
        } else if (kind == MediaType.VIDEO) {
            errors.add("Vídeo ainda não: falta o processamento que tira os metadados e gera o pôster (OS-23, próxima etapa).");
        } else if (kind == MediaType.AUDIO) {
            errors.add("Áudio chega com o Audio Feed (OS-24).");
        }
        String type = contentType == null ? "" : contentType.split(";")[0].strip().toLowerCase(Locale.ROOT);
        String extension = IMAGE_TYPES.get(type);
        if (kind == MediaType.IMAGE && extension == null) {
            errors.add("Envie a foto em JPEG ou PNG.");
        }
        if (sizeBytes == null || sizeBytes < 1 || sizeBytes > MAX_IMAGE_BYTES) {
            errors.add("A foto vai até 10 MB.");
        }
        if (!errors.isEmpty()) {
            throw new PostExceptions.Invalid(errors);
        }
        String key = "uploads/" + viewerId + "/" + UuidV7.next() + "." + extension;
        PresignedUpload put = storage.presignPut(key, type, sizeBytes, UPLOAD_TTL);
        return new UploadTicket(key, put.url(), put.method(), put.headers(), put.expiresAt(), MAX_IMAGE_BYTES);
    }

    /**
     * Valida o envio do autor e grava a versão limpa; devolve a chave pública. Chave de outra pessoa, que não existe
     * ou que expirou dão a mesma resposta, sem revelar qual.
     */
    String attachImage(long authorId, String uploadKey) {
        Matcher m = uploadKey == null ? null : UPLOAD_KEY.matcher(uploadKey);
        if (m == null || !m.matches() || Long.parseLong(m.group(1)) != authorId) {
            throw invalid(UPLOAD_NOT_FOUND);
        }
        Optional<StoredObject> head = storage.head(uploadKey);
        if (head.isEmpty()) {
            throw invalid(UPLOAD_NOT_FOUND);
        }
        if (head.get().sizeBytes() > MAX_IMAGE_BYTES) {
            throw invalid("A foto vai até 10 MB.");
        }
        CleanImage clean;
        try {
            clean = ImageSanitizer.sanitize(storage.read(uploadKey));
        } catch (ImageSanitizer.Rejected e) {
            throw invalid(e.getMessage());
        }
        String publicKey = "posts/" + UuidV7.next() + "." + clean.extension();
        storage.write(publicKey, clean.bytes(), clean.contentType());
        janitor.deleteOnRollback(publicKey);
        janitor.deleteAfterCommit(List.of(uploadKey));
        return publicKey;
    }

    /** O banco deixou de apontar para a mídia (post apagado): o objeto sai do bucket depois do commit. */
    void discard(String objectKey) {
        janitor.deleteAfterCommit(objectKey == null ? List.of() : List.of(objectKey));
    }

    private static PostExceptions.Invalid invalid(String message) {
        return new PostExceptions.Invalid(List.of(message));
    }
}
