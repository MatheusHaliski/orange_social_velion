package com.orangesocial.infrastructure.persistence.postgres;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * schema.sql é a DDL de referência exigida pelo projeto; o Flyway aplica
 * db/migration/V1__baseline.sql. Este teste impede que os dois divirjam.
 */
class SchemaConsistencyTest {

    @Test
    void flywayBaselineMatchesReferenceSchema() throws IOException {
        String reference = read("schema.sql");
        String baseline = read("db/migration/V1__baseline.sql");

        assertThat(baseline).isEqualTo(reference);
        assertThat(reference).contains("CREATE TABLE IF NOT EXISTS \"VSusercontrolist\"");
    }

    private static String read(String path) throws IOException {
        return new ClassPathResource(path).getContentAsString(StandardCharsets.UTF_8);
    }
}
