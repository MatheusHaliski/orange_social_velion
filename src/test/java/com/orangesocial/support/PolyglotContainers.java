package com.orangesocial.support;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.test.context.DynamicPropertyRegistrar;
import org.testcontainers.cassandra.CassandraContainer;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

import java.time.Duration;

/**
 * Containers da persistência poliglota para testes de integração (*IT).
 * Os mesmos serviços/imagens do docker-compose.yml. {@code @ServiceConnection}
 * injeta host/porta/credenciais no Spring Boot sem propriedades manuais; o Garage (API S3),
 * que não tem {@code @ServiceConnection}, entra pelas propriedades {@code orange-social.storage.*}.
 * Os containers são reutilizados entre as classes de teste da mesma JVM.
 */
@TestConfiguration(proxyBeanMethods = false)
public class PolyglotContainers {

    static final String POSTGIS_IMAGE = "postgis/postgis:17-3.5";
    static final String VALKEY_IMAGE = "valkey/valkey:9-alpine";
    static final String CASSANDRA_IMAGE = "cassandra:5.0";

    @Bean
    @ServiceConnection
    PostgreSQLContainer postgres() {
        return new PostgreSQLContainer(DockerImageName.parse(POSTGIS_IMAGE).asCompatibleSubstituteFor("postgres"))
                .withDatabaseName("orange_social")
                .withUsername("orange")
                .withPassword("orange")
                .withReuse(true);
    }

    /** Valkey fala o protocolo Redis; o nome "redis" liga o container ao RedisConnectionDetails. */
    @Bean
    @ServiceConnection(name = "redis")
    GenericContainer<?> valkey() {
        return new GenericContainer<>(DockerImageName.parse(VALKEY_IMAGE))
                .withExposedPorts(6379)
                .withReuse(true);
    }

    @Bean
    @ServiceConnection
    CassandraContainer cassandra() {
        return new CassandraContainer(DockerImageName.parse(CASSANDRA_IMAGE))
                .withInitScript("cassandra/schema.cql")
                .withEnv("MAX_HEAP_SIZE", "1G")
                .withEnv("HEAP_NEWSIZE", "256M")
                .withStartupTimeout(Duration.ofMinutes(4))
                .withReuse(true);
    }

    @Bean
    GarageContainer garage() {
        return new GarageContainer().withReuse(true);
    }

    @Bean
    DynamicPropertyRegistrar storageProperties(GarageContainer garage) {
        return registry -> {
            registry.add("orange-social.storage.endpoint", garage::s3Endpoint);
            registry.add("orange-social.storage.presign-endpoint", garage::s3Endpoint);
            registry.add("orange-social.storage.region", () -> GarageContainer.REGION);
            registry.add("orange-social.storage.bucket", () -> GarageContainer.BUCKET);
            registry.add("orange-social.storage.access-key", () -> GarageContainer.ACCESS_KEY);
            registry.add("orange-social.storage.secret-key", () -> GarageContainer.SECRET_KEY);
        };
    }
}
