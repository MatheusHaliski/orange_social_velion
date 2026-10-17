package com.orangesocial.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.cassandra.repository.config.EnableCassandraRepositories;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/**
 * Persistência poliglota: cada módulo Spring Data só enxerga o seu pacote,
 * evitando ambiguidade entre repositórios JPA (MySQL) e Cassandra.
 * O Redis é acessado via {@code StringRedisTemplate} (TrendingScoreRepository).
 */
@Configuration
@EnableJpaRepositories(basePackages = "com.orangesocial.infrastructure.persistence.mysql")
@EnableCassandraRepositories(basePackages = "com.orangesocial.infrastructure.persistence.cassandra")
public class PersistenceConfig {
}
