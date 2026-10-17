package com.orangesocial.application.account;

import com.orangesocial.domain.model.CategoryVerification;
import com.orangesocial.domain.model.Cnpj;
import com.orangesocial.domain.model.UserCategoryEnum;

import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Campos específicos de cada uma das 6 categorias (docs/PESQUISA_DADOS_USUARIO.md §3), guardados em
 * {@code type_details}. Só as chaves listadas são aceitas (minimização: nada de campo livre que vire depósito
 * de dado pessoal). Chaves "privadas" nunca aparecem no perfil público.
 */
public final class UserTypeDetailsValidator {

    private static final Pattern URL = Pattern.compile("^https?://[^\\s/$.?#].[^\\s]{1,200}$");
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final int MAX_TEXT = 200;

    /** Campos que só o titular e a moderação veem. */
    public static final Set<String> PRIVATE_KEYS = Set.of("contactName", "contactRole", "contactEmail",
            "representativeName", "representativeRole", "representativeEmail", "mtbRegistration", "guardianEmail");

    record Rule(Set<String> required, Set<String> optional, Map<String, Set<String>> choices) {
    }

    private static final Map<UserCategoryEnum, Rule> RULES = Map.of(
            UserCategoryEnum.VERDE, new Rule(Set.of(),
                    Set.of("city", "state", "website", "occupation", "education", "guardianEmail"), Map.of()),
            UserCategoryEnum.AMARELO, new Rule(Set.of("subtype", "outletName", "website", "role"),
                    Set.of("mtbRegistration", "cnpj", "city", "state"),
                    Map.of("subtype", Set.of("OUTLET", "BLOG", "FORUM", "NETWORKING"))),
            UserCategoryEnum.AZUL, new Rule(Set.of("cnpj", "legalName", "website", "segment", "contactName", "contactRole", "contactEmail"),
                    Set.of("tradeName", "city", "state"),
                    Map.of("segment", Set.of("AGENCY", "ADVERTISER", "CREATOR_COMPANY"))),
            UserCategoryEnum.LARANJA, new Rule(Set.of("communityType", "city", "state", "contactName", "contactEmail"),
                    Set.of("cnpj", "headquarters", "website"),
                    Map.of("communityType", Set.of("CHURCH", "SPORTS_CLUB", "SOCIAL_CLUB", "COLLECTIVE", "INFORMAL_GROUP", "OTHER"))),
            UserCategoryEnum.VERMELHO, new Rule(Set.of("subtype", "cnpj", "legalName", "website", "sector",
                    "representativeName", "representativeRole", "representativeEmail"),
                    Set.of("size", "headquarters", "city", "state"),
                    Map.of("subtype", Set.of("GOVERNMENT", "COMPANY", "BRAND"),
                            "size", Set.of("1-10", "11-50", "51-200", "201-1000", "1000+"))),
            UserCategoryEnum.PRETO, new Rule(Set.of("subtype", "organizer"),
                    Set.of("eventName", "eventStart", "eventLocation", "cnpj", "bcbCode", "expiresAt", "city", "state"),
                    Map.of("subtype", Set.of("CLOSE_FRIENDS", "EVENT", "SPECIAL_SITUATION", "BANK"))));

    private UserTypeDetailsValidator() {
    }

    /** Valida e normaliza; lança {@link AccountExceptions.Invalid} com todos os problemas de uma vez. */
    public static Map<String, Object> validate(UserCategoryEnum type, Map<String, Object> raw) {
        Rule rule = RULES.get(type);
        Map<String, Object> in = raw == null ? Map.of() : raw;
        List<String> errors = new ArrayList<>();
        Map<String, Object> out = new LinkedHashMap<>();
        for (Map.Entry<String, Object> e : in.entrySet()) {
            if (!rule.required().contains(e.getKey()) && !rule.optional().contains(e.getKey())) {
                errors.add("Campo \"" + e.getKey() + "\" não se aplica à categoria " + type.getLabel() + ".");
                continue;
            }
            if (e.getValue() == null || e.getValue().toString().isBlank()) {
                continue;
            }
            String v = e.getValue().toString().strip();
            if (v.length() > MAX_TEXT) {
                errors.add("Campo \"" + e.getKey() + "\" passa de " + MAX_TEXT + " caracteres.");
                continue;
            }
            out.put(e.getKey(), v);
        }
        for (String req : rule.required()) {
            if (!out.containsKey(req)) {
                errors.add("Preencha o campo \"" + req + "\" da categoria " + type.getLabel() + ".");
            }
        }
        rule.choices().forEach((key, allowed) -> {
            if (out.containsKey(key) && !allowed.contains(out.get(key).toString())) {
                errors.add("Valor inválido para \"" + key + "\": use " + String.join(", ", allowed) + ".");
            }
        });
        out.computeIfPresent("cnpj", (k, v) -> Cnpj.normalize(v.toString()));
        if (out.containsKey("cnpj") && !Cnpj.isValid(out.get("cnpj").toString())) {
            errors.add("CNPJ inválido. Confira os 14 caracteres (o CNPJ pode ter letras desde 2026).");
        }
        for (String key : List.of("website")) {
            if (out.containsKey(key) && !URL.matcher(out.get(key).toString()).matches()) {
                errors.add("Informe o site completo, começando com https://");
            }
        }
        for (String key : List.of("contactEmail", "representativeEmail", "guardianEmail")) {
            if (out.containsKey(key) && !EMAIL.matcher(out.get(key).toString()).matches()) {
                errors.add("E-mail inválido em \"" + key + "\".");
            }
        }
        if (type == UserCategoryEnum.PRETO) {
            String subtype = String.valueOf(out.get("subtype"));
            if ("EVENT".equals(subtype)) {
                for (String req : List.of("eventName", "eventStart", "eventLocation")) {
                    if (!out.containsKey(req)) {
                        errors.add("Evento precisa de nome, data/hora e local (\"" + req + "\").");
                    }
                }
                if (out.containsKey("eventStart")) {
                    try {
                        Instant.parse(out.get("eventStart").toString());
                    } catch (DateTimeParseException ex) {
                        errors.add("eventStart deve estar em ISO-8601, ex.: 2026-12-05T19:00:00Z.");
                    }
                }
            }
            if ("BANK".equals(subtype) && (!out.containsKey("cnpj") || !out.containsKey("bcbCode"))) {
                errors.add("Banco precisa de CNPJ e do código no Banco Central (bcbCode).");
            }
            if (out.containsKey("bcbCode") && !out.get("bcbCode").toString().matches("\\d{3}")) {
                errors.add("bcbCode tem 3 dígitos (ex.: 001).");
            }
            if (out.containsKey("expiresAt")) {
                try {
                    LocalDate.parse(out.get("expiresAt").toString());
                } catch (DateTimeParseException ex) {
                    errors.add("expiresAt deve ser uma data, ex.: 2027-01-31.");
                }
            }
        }
        if (!errors.isEmpty()) {
            throw new AccountExceptions.Invalid(errors);
        }
        return out;
    }

    /** VERMELHO e banco (PRETO) só publicam depois da moderação conferir CNPJ, domínio e representante. */
    public static CategoryVerification initialVerification(UserCategoryEnum type, Map<String, Object> details) {
        if (type == UserCategoryEnum.VERMELHO
                || type == UserCategoryEnum.PRETO && "BANK".equals(String.valueOf(details.get("subtype")))) {
            return CategoryVerification.PENDING;
        }
        return CategoryVerification.NOT_REQUIRED;
    }

    /** Versão pública: sem as chaves privadas. */
    public static Map<String, Object> publicView(Map<String, Object> details) {
        Map<String, Object> out = new LinkedHashMap<>(details == null ? Map.of() : details);
        out.keySet().removeAll(PRIVATE_KEYS);
        return out;
    }
}
