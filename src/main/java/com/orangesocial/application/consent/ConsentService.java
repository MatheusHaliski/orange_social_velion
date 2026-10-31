package com.orangesocial.application.consent;

import com.orangesocial.application.account.AccountExceptions;
import com.orangesocial.application.account.AgePolicy;
import com.orangesocial.application.account.LegalDocuments;
import com.orangesocial.domain.model.ConsentPurpose;
import com.orangesocial.domain.model.UserControlList;
import com.orangesocial.infrastructure.persistence.postgres.UserControlListRepository;
import com.orangesocial.security.ClientInfo;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * RF3 · consentimentos (LGPD Art. 7º, I · Art. 8º, §5º · Art. 11). Ligar e desligar é igualmente fácil; cada mudança
 * gera uma linha nova em {@code consent_event} (append-only) e o estado atual vem de {@code user_consent_current}.
 * Desligar tem efeito imediato na mesma transação: SENSITIVE_PROFILE_DATA apaga a orientação sexual e
 * LOCATION_TRACKING apaga a última localização salva. FACIAL_RECOGNITION não tem dado no servidor (o modelo do rosto
 * fica só no aparelho, OS-42): o app confere o estado e apaga o modelo local quando a finalidade está desligada.
 */
@Service
public class ConsentService {

    private final UserControlListRepository users;
    private final JdbcTemplate jdbc;
    private final LegalDocuments legal;
    private final AgePolicy age;

    public ConsentService(UserControlListRepository users, JdbcTemplate jdbc, LegalDocuments legal, AgePolicy age) {
        this.users = users;
        this.jdbc = jdbc;
        this.legal = legal;
        this.age = age;
    }

    public record ConsentView(ConsentPurpose purpose, String label, String description, String legalBasis,
                              boolean sensitive, boolean granted, Instant updatedAt, boolean lockedForMinor) {
    }

    public record ConsentList(List<ConsentView> items) {
    }

    private record Current(boolean granted, Instant at) {
    }

    @Transactional(readOnly = true)
    public ConsentList list(long userId) {
        UserControlList u = users.findById(userId).orElseThrow();
        Map<ConsentPurpose, Current> current = current(userId);
        List<ConsentView> items = new ArrayList<>();
        for (ConsentPurpose p : ConsentPurpose.values()) {
            items.add(view(p, current.get(p), u));
        }
        return new ConsentList(items);
    }

    /** Estado atual de uma finalidade; sem evento gravado vale o padrão, desligado. */
    @Transactional(readOnly = true)
    public boolean granted(long userId, ConsentPurpose purpose) {
        Current c = current(userId).get(purpose);
        return c != null && c.granted();
    }

    @Transactional
    public ConsentView set(long userId, String purposeCode, Boolean granted, ClientInfo client) {
        ConsentPurpose purpose = ConsentPurpose.fromCode(purposeCode)
                .orElseThrow(() -> new AccountExceptions.NotFound("Finalidade de consentimento desconhecida."));
        if (granted == null) {
            throw new AccountExceptions.Invalid("Informe granted: true para ligar ou false para desligar.");
        }
        // trava a linha da conta: duas mudanças da mesma pessoa ficam em fila e o histórico sai na ordem certa
        UserControlList u = users.lockById(userId).orElseThrow();
        if (granted && lockedForMinor(purpose, u)) {
            throw new AccountExceptions.Forbidden(purpose.getMinorRule() == ConsentPurpose.MinorRule.UNDER_18
                    ? "Para menores de 18 anos, \"" + purpose.getLabel() + "\" fica desligado até o responsável "
                    + "consentir (LGPD Art. 14)."
                    : "Para menores de 16 anos, \"" + purpose.getLabel() + "\" fica desligado (ECA Digital).");
        }
        Current before = current(userId).get(purpose);
        if (before == null || before.granted() != granted) {
            // clock_timestamp(), e não now(): a transação que esperou a trava grava depois, com hora posterior
            jdbc.update("""
                    INSERT INTO consent_event (user_id, purpose, legal_basis, granted, policy_version, channel, ip_hash,
                                               occurred_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, clock_timestamp())
                    """, userId, purpose.name(), purpose.getLegalBasis(), granted, legal.privacyVersion(),
                    client.channel(), client.ipHash());
        }
        if (!granted) {
            revokeEffects(purpose, u);
        }
        return view(purpose, current(userId).get(purpose), u);
    }

    /** Grava as finalidades desligadas no cadastro (RF1), na mesma transação da conta. */
    public void recordDefaults(long userId, ClientInfo client) {
        for (ConsentPurpose p : ConsentPurpose.values()) {
            jdbc.update("""
                    INSERT INTO consent_event (user_id, purpose, legal_basis, granted, policy_version, channel, ip_hash)
                    VALUES (?, ?, ?, FALSE, ?, ?, ?)
                    """, userId, p.name(), p.getLegalBasis(), legal.privacyVersion(), client.channel(), client.ipHash());
        }
    }

    private void revokeEffects(ConsentPurpose purpose, UserControlList u) {
        switch (purpose) {
            case SENSITIVE_PROFILE_DATA -> {
                if (u.getSexualPreference() != null) {
                    u.setSexualPreference(null);
                    users.save(u);
                }
            }
            case LOCATION_TRACKING -> {
                if (u.getLastSavedLocation() != null) {
                    u.setLastSavedLocation(null);
                    users.save(u);
                }
            }
            default -> {
                // PERSONALIZED_FEED, MARKETING e THIRD_PARTY_SHARING: quem consome confere o estado atual a cada uso;
                // FACIAL_RECOGNITION: nada no servidor, o app apaga o modelo do rosto ao ver granted = false
            }
        }
    }

    private Map<ConsentPurpose, Current> current(long userId) {
        Map<ConsentPurpose, Current> out = new EnumMap<>(ConsentPurpose.class);
        jdbc.query("SELECT purpose, granted, occurred_at FROM user_consent_current WHERE user_id = ?", rs -> {
            Timestamp at = rs.getTimestamp("occurred_at");
            Current c = new Current(rs.getBoolean("granted"), at == null ? null : at.toInstant());
            ConsentPurpose.fromCode(rs.getString("purpose")).ifPresent(p -> out.put(p, c));
        }, userId);
        return out;
    }

    private boolean lockedForMinor(ConsentPurpose p, UserControlList u) {
        return switch (p.getMinorRule()) {
            case NONE -> false;
            case UNDER_16 -> age.protectedMinor(u.getUserDateOfBirth());
            case UNDER_18 -> !age.adult(u.getUserDateOfBirth());
        };
    }

    private ConsentView view(ConsentPurpose p, Current c, UserControlList u) {
        return new ConsentView(p, p.getLabel(), p.getDescription(), p.getLegalBasis(), p.isSensitive(),
                c != null && c.granted(), c == null ? null : c.at(), lockedForMinor(p, u));
    }
}
