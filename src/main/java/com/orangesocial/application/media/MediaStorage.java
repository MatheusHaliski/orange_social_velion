package com.orangesocial.application.media;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;

/**
 * Bucket de mídia (API S3: AWS S3 em produção, Garage em desenvolvimento). O banco guarda só a chave do objeto;
 * o cliente envia o arquivo direto ao bucket por uma URL pré-assinada e a API nunca recebe os bytes do upload.
 */
public interface MediaStorage {

    /** URL de {@code PUT} válida por {@code ttl}, presa ao tipo e ao tamanho exatos declarados. */
    PresignedUpload presignPut(String objectKey, String contentType, long sizeBytes, Duration ttl);

    /** Metadados do objeto ou vazio se ele não existe. */
    Optional<StoredObject> head(String objectKey);

    /** Lê o objeto inteiro; quem chama já conferiu o tamanho no {@link #head}. */
    byte[] read(String objectKey);

    void write(String objectKey, byte[] bytes, String contentType);

    /** Apagar é idempotente: objeto que não existe não é erro. */
    void delete(String objectKey);

    record PresignedUpload(String url, String method, Map<String, String> headers, Instant expiresAt) {
    }

    record StoredObject(String contentType, long sizeBytes) {
    }
}
