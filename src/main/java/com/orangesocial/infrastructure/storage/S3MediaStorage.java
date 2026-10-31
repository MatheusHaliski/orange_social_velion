package com.orangesocial.infrastructure.storage;

import com.orangesocial.application.media.MediaStorage;
import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.checksums.RequestChecksumCalculation;
import software.amazon.awssdk.core.checksums.ResponseChecksumValidation;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;

import java.net.URI;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * {@link MediaStorage} sobre a API S3 (AWS SDK v2). Endereço por caminho ({@code /bucket/chave}) para funcionar
 * igual no Garage e na AWS. A URL pré-assinada pode usar outro endereço ({@code presign-endpoint}): o app fala
 * com o bucket pela rede interna, e o celular, pelo endereço público.
 *
 * <p>Dois buckets: os originais enviados pelo app ({@code uploads/…}, com EXIF/GPS e ainda sem dono conferido)
 * ficam num bucket <b>privado</b>; o bucket de mídias, servido publicamente pela CDN (ou pela leitura pública do
 * Garage em dev), só recebe as versões limpas ({@code posts/}, {@code avatars/}, {@code backgrounds/}). Assim nada
 * em {@code uploads/} é legível sem passar pela conferência de dono e pelo {@code ImageSanitizer}.
 *
 * <p>Sem chave de acesso configurada, as credenciais vêm da cadeia padrão da AWS (papel da instância, variáveis
 * {@code AWS_*}); nada de segredo no yml.
 */
@Component
public class S3MediaStorage implements MediaStorage {

    private static final List<String> UNSIGNED_FOR_CLIENT = List.of("host");
    static final String UPLOADS_PREFIX = "uploads/";

    private final String bucket;
    private final String uploadsBucket;
    private final S3Client s3;
    private final S3Presigner presigner;

    public S3MediaStorage(@Value("${orange-social.storage.endpoint}") String endpoint,
                          @Value("${orange-social.storage.presign-endpoint:${orange-social.storage.endpoint}}") String presignEndpoint,
                          @Value("${orange-social.storage.region}") String region,
                          @Value("${orange-social.storage.bucket}") String bucket,
                          @Value("${orange-social.storage.uploads-bucket}") String uploadsBucket,
                          @Value("${orange-social.storage.access-key:}") String accessKey,
                          @Value("${orange-social.storage.secret-key:}") String secretKey) {
        if (bucket.equals(uploadsBucket)) {
            throw new IllegalStateException("orange-social.storage.uploads-bucket precisa ser diferente do bucket público "
                    + "de mídias: os originais em uploads/ não podem ficar legíveis.");
        }
        this.bucket = bucket;
        this.uploadsBucket = uploadsBucket;
        AwsCredentialsProvider credentials = accessKey.isBlank()
                ? DefaultCredentialsProvider.builder().build()
                : StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey));
        S3Configuration pathStyle = S3Configuration.builder().pathStyleAccessEnabled(true).build();
        this.s3 = S3Client.builder()
                .endpointOverride(URI.create(endpoint))
                .region(Region.of(region))
                .credentialsProvider(credentials)
                .serviceConfiguration(pathStyle)
                // checksum só quando a operação exige: compatível com Garage e outros S3 além da AWS
                .requestChecksumCalculation(RequestChecksumCalculation.WHEN_REQUIRED)
                .responseChecksumValidation(ResponseChecksumValidation.WHEN_REQUIRED)
                .httpClient(UrlConnectionHttpClient.builder()
                        .connectionTimeout(Duration.ofSeconds(5))
                        .socketTimeout(Duration.ofSeconds(30))
                        .build())
                .build();
        this.presigner = S3Presigner.builder()
                .endpointOverride(URI.create(presignEndpoint))
                .region(Region.of(region))
                .credentialsProvider(credentials)
                .serviceConfiguration(pathStyle)
                .build();
    }

    @Override
    public PresignedUpload presignPut(String objectKey, String contentType, long sizeBytes, Duration ttl) {
        PresignedPutObjectRequest signed = presigner.presignPutObject(p -> p
                .signatureDuration(ttl)
                .putObjectRequest(r -> r.bucket(bucketFor(objectKey)).key(objectKey)
                        .contentType(contentType)
                        .contentLength(sizeBytes)));
        Map<String, String> headers = new LinkedHashMap<>();
        signed.signedHeaders().forEach((name, values) -> {
            if (!UNSIGNED_FOR_CLIENT.contains(name.toLowerCase())) {
                headers.put(name, String.join(",", values));
            }
        });
        return new PresignedUpload(signed.url().toString(), signed.httpRequest().method().name(), headers,
                signed.expiration());
    }

    @Override
    public Optional<StoredObject> head(String objectKey) {
        try {
            HeadObjectResponse head = s3.headObject(r -> r.bucket(bucketFor(objectKey)).key(objectKey));
            return Optional.of(new StoredObject(head.contentType(), head.contentLength()));
        } catch (NoSuchKeyException e) {
            return Optional.empty();
        } catch (S3Exception e) {
            if (e.statusCode() == 404) {
                return Optional.empty();
            }
            throw e;
        }
    }

    @Override
    public byte[] read(String objectKey) {
        return s3.getObjectAsBytes(r -> r.bucket(bucketFor(objectKey)).key(objectKey)).asByteArray();
    }

    @Override
    public void write(String objectKey, byte[] bytes, String contentType) {
        s3.putObject(r -> r.bucket(bucketFor(objectKey)).key(objectKey).contentType(contentType)
                        // a chave nunca muda: a CDN e o app guardam o arquivo por um ano
                        .cacheControl("public, max-age=31536000, immutable"),
                RequestBody.fromBytes(bytes));
    }

    @Override
    public void delete(String objectKey) {
        s3.deleteObject(r -> r.bucket(bucketFor(objectKey)).key(objectKey));
    }

    /** Originais no bucket privado; versões limpas no público. */
    String bucketFor(String objectKey) {
        return objectKey.startsWith(UPLOADS_PREFIX) ? uploadsBucket : bucket;
    }

    @PreDestroy
    void close() {
        presigner.close();
        s3.close();
    }
}
