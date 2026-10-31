package com.orangesocial.infrastructure.persistence.postgres;

import com.orangesocial.domain.model.UserMfa;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface UserMfaRepository extends JpaRepository<UserMfa, Long> {

    /**
     * Anti-replay atômico: aceita o passo do TOTP só se for posterior ao último usado. Com duas requisições ao mesmo
     * tempo, a segunda espera a trava da linha e não acha mais nada para atualizar. 1 = aceito, 0 = código já usado.
     */
    @Modifying
    @Query("update UserMfa m set m.lastUsedStep = :step where m.userId = :userId and m.lastUsedStep < :step")
    int consumeStep(Long userId, long step);

    /** Liga o 2FA só se ele ainda não estiver ligado: nunca sobrescreve o fator ativo. 1 = ligado, 0 = já estava. */
    @Modifying
    @Query(value = """
            INSERT INTO user_mfa (user_id, totp_secret, enabled_at, last_used_step)
            VALUES (:userId, :secret, now(), :step)
            ON CONFLICT (user_id) DO NOTHING
            """, nativeQuery = true)
    int enableIfAbsent(Long userId, byte[] secret, long step);
}
