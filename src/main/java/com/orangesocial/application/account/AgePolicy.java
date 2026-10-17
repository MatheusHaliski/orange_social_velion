package com.orangesocial.application.account;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDate;
import java.time.Period;
import java.time.ZoneId;

/**
 * Idade (docs/PESQUISA_DADOS_USUARIO.md §1, regras 2–3): mínimo de 13 anos; menor de 16 tem configurações
 * protetivas travadas e precisa do e-mail do responsável (ECA Digital, art. 24 — vínculo completo no OS-49);
 * contas de organização exigem responsável adulto (18+).
 */
@Component
public class AgePolicy {

    public static final int ADULT = 18;
    private static final ZoneId BRAZIL = ZoneId.of("America/Sao_Paulo");

    private final int minimumAge;
    private final int protectedUntil;
    private final Clock clock;

    public AgePolicy(@Value("${orange-social.registration.minimum-age:13}") int minimumAge,
                     @Value("${orange-social.registration.protected-until-age:16}") int protectedUntil, Clock clock) {
        this.minimumAge = minimumAge;
        this.protectedUntil = protectedUntil;
        this.clock = clock;
    }

    public int ageOf(LocalDate birth) {
        return Period.between(birth, LocalDate.now(clock.withZone(BRAZIL))).getYears();
    }

    public boolean tooYoung(LocalDate birth) {
        return ageOf(birth) < minimumAge;
    }

    /** Menor protegido pelo ECA Digital: padrões restritivos que só o responsável pode afrouxar. */
    public boolean protectedMinor(LocalDate birth) {
        return birth != null && ageOf(birth) < protectedUntil;
    }

    public boolean adult(LocalDate birth) {
        return birth != null && ageOf(birth) >= ADULT;
    }

    public int minimumAge() {
        return minimumAge;
    }
}
