package com.orangesocial.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.password.DelegatingPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextHolderFilter;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;

import java.time.Clock;
import java.time.Duration;
import java.util.Map;

/**
 * Autenticação, sessão e controle de acesso (RF27 · docs/PESQUISA_DADOS_USUARIO.md §6).
 *
 * <ul>
 *   <li>Sessão opaca no Valkey (Spring Session), cookie sem Max-Age: fechar o navegador encerra, e uma aba
 *       anônima — que tem cookies próprios — abre deslogada. Nada de token em localStorage.</li>
 *   <li>Login, 2FA, reativação e logout são endpoints próprios em {@code /api/v1/auth}; não há form login,
 *       HTTP Basic nem "lembrar de mim".</li>
 *   <li>CSRF no padrão SPA: cookie {@code XSRF-TOKEN} + cabeçalho {@code X-XSRF-TOKEN} em toda escrita.</li>
 *   <li>Leitura pública de posts, perfis e documentos legais; o resto exige sessão. Regras por estado da conta
 *       (ativa, pendente, suspensa) ficam nos serviços.</li>
 * </ul>
 */
@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain api(HttpSecurity http, Clock clock,
                            @Value("${orange-social.security.session-absolute-timeout:24h}") Duration absoluteTimeout)
            throws Exception {
        http
                .csrf(csrf -> csrf.spa())
                .securityContext(c -> c.securityContextRepository(securityContextRepository()))
                .sessionManagement(s -> s.sessionFixation(f -> f.changeSessionId()))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.GET, "/api/v1/posts/**", "/api/v1/users/**", "/api/v1/legal/**",
                                "/api/v1/backgrounds/**")
                        .permitAll()
                        .requestMatchers("/api/v1/auth/**", "/error").permitAll()
                        .anyRequest().authenticated())
                .exceptionHandling(e -> e
                        .authenticationEntryPoint(ProblemResponses.unauthorized())
                        .accessDeniedHandler(ProblemResponses.denied()))
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .requestCache(AbstractHttpConfigurer::disable)
                .headers(h -> h
                        .contentSecurityPolicy(csp -> csp.policyDirectives("default-src 'none'; frame-ancestors 'none'"))
                        .referrerPolicy(r -> r.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.NO_REFERRER)))
                .addFilterAfter(new AbsoluteSessionTimeoutFilter(absoluteTimeout, clock), SecurityContextHolderFilter.class);
        return http.build();
    }

    @Bean
    SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    /** Argon2id (m = 19 MiB, t = 2, p = 1 — OWASP/ADR-09) dentro de um DelegatingPasswordEncoder ({argon2}…). */
    @Bean
    PasswordEncoder passwordEncoder() {
        Argon2PasswordEncoder argon2 = new Argon2PasswordEncoder(16, 32, 1, 19 * 1024, 2);
        return new DelegatingPasswordEncoder("argon2", Map.of("argon2", argon2));
    }

    /** O login é feito pelo AuthService; este bean só impede o usuário em memória padrão do Spring Boot. */
    @Bean
    UserDetailsService noInMemoryUsers() {
        return username -> {
            throw new UsernameNotFoundException("Login apenas por POST /api/v1/auth/login");
        };
    }

    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }
}
