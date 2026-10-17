package com.orangesocial.infrastructure.persistence.postgres;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Comparator;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * schema.sql é a DDL de referência exigida pelo projeto; o Flyway aplica db/migration/V*.sql.
 * Regra: schema.sql == V1 + V2 + ... + Vn concatenados em ordem de versão. Este teste impede
 * que a referência e as migrações divirjam.
 */
class SchemaConsistencyTest {

    private static final Pattern VERSION = Pattern.compile("^V(\\d+)__.+\\.sql$");

    @Test
    void referenceSchemaIsTheConcatenationOfAllMigrations() throws IOException {
        Resource[] migrations = new PathMatchingResourcePatternResolver()
                .getResources("classpath:db/migration/V*__*.sql");
        assertThat(migrations).isNotEmpty();

        StringBuilder concatenated = new StringBuilder();
        for (Resource migration : Arrays.stream(migrations)
                .sorted(Comparator.comparingInt(SchemaConsistencyTest::version))
                .toList()) {
            concatenated.append(migration.getContentAsString(StandardCharsets.UTF_8));
        }

        String reference = new ClassPathResource("schema.sql").getContentAsString(StandardCharsets.UTF_8);
        assertThat(concatenated.toString()).isEqualTo(reference);
        assertThat(reference)
                .contains("CREATE TABLE IF NOT EXISTS \"VSusercontrolist\"")
                .contains("CREATE TABLE IF NOT EXISTS post (");
    }

    private static int version(Resource migration) {
        Matcher m = VERSION.matcher(migration.getFilename());
        if (!m.matches()) {
            throw new IllegalStateException("Migração fora do padrão V{n}__nome.sql: " + migration.getFilename());
        }
        return Integer.parseInt(m.group(1));
    }
}
