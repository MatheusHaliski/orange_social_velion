package com.orangesocial.domain.model;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.UUID;

/**
 * UUID versão 7 (RFC 9562): 48 bits de timestamp em ms + aleatório. Ordenável por tempo, o que
 * mantém o índice B-tree compacto e permite usar o mesmo id como post_id na timeline do Cassandra.
 */
public final class UuidV7 {

    private static final SecureRandom RANDOM = new SecureRandom();

    private UuidV7() {
    }

    public static UUID next() {
        return at(Instant.now());
    }

    static UUID at(Instant instant) {
        long millis = instant.toEpochMilli();
        long randA = RANDOM.nextInt(1 << 12);
        long msb = (millis << 16) | 0x7000L | randA;
        long lsb = (RANDOM.nextLong() & 0x3FFF_FFFF_FFFF_FFFFL) | 0x8000_0000_0000_0000L;
        return new UUID(msb, lsb);
    }
}
