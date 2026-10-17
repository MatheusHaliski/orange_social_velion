package com.orangesocial.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Jobs agendados (ex.: eliminação de contas após os 30 dias). Desligáveis com orange-social.jobs.enabled=false. */
@Configuration
@EnableScheduling
@ConditionalOnProperty(name = "orange-social.jobs.enabled", havingValue = "true", matchIfMissing = true)
public class SchedulingConfig {
}
