package com.orangesocial.infrastructure.storage;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Originais em bucket privado, versões limpas no público (achado da revisão do PR #13). */
class S3MediaStorageTest {

    private static S3MediaStorage storage(String bucket, String uploads) {
        return new S3MediaStorage("http://localhost:3900", "http://localhost:3900", "sa-east-1", bucket, uploads,
                "GKtest", "segredo-de-teste");
    }

    @Test
    void originalsGoToThePrivateBucketAndCleanVersionsToThePublicOne() {
        S3MediaStorage s = storage("midias", "uploads-privado");
        assertThat(s.bucketFor("uploads/42/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b.jpg")).isEqualTo("uploads-privado");
        assertThat(s.bucketFor("posts/0190a1b2.jpg")).isEqualTo("midias");
        assertThat(s.bucketFor("avatars/0190a1b2.jpg")).isEqualTo("midias");
        assertThat(s.bucketFor("backgrounds/aura-plus/brasa-hq.mp4")).isEqualTo("midias");
    }

    @Test
    void refusesTheSameBucketForUploadsAndPublicMedia() {
        assertThatThrownBy(() -> storage("midias", "midias")).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("uploads-bucket");
    }
}
