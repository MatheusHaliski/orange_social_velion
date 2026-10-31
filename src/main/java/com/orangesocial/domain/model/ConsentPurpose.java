package com.orangesocial.domain.model;

import java.util.Arrays;
import java.util.Optional;

/**
 * Finalidades opcionais de tratamento (RF3). Todas nascem desligadas (Privacy by Default) e cada mudança vira uma
 * linha em {@code consent_event}. {@link MinorRule}: até que idade a finalidade fica travada. Menor de 16 não liga
 * perfilamento, publicidade dirigida nem rastreio de localização (ECA Digital); dado sensível (orientação sexual) e
 * biometria ficam travados para menor de 18 enquanto não houver o consentimento do responsável (LGPD Art. 14).
 * A ordem do enum é a ordem da tela Configurações → Privacidade.
 */
public enum ConsentPurpose {
    LOCATION_TRACKING("Guardar minha localização",
            "Guarda a última localização do aparelho para mostrar pessoas, comunidades e eventos perto de você. "
                    + "Desligar apaga a localização salva.", "ART_7_I", false, MinorRule.UNDER_16),
    PERSONALIZED_FEED("Feed pelos meus interesses",
            "Ordena o feed pelos seus interesses, comunidades e pelo que você curtiu e salvou.", "ART_7_I", false,
            MinorRule.UNDER_16),
    SENSITIVE_PROFILE_DATA("Orientação sexual no perfil",
            "Guarda sua orientação sexual, um dado sensível, para mostrar só a quem você escolher. "
                    + "Desligar apaga o que estiver salvo.", "ART_11_I", true, MinorRule.UNDER_18),
    FACIAL_RECOGNITION("Reconhecimento facial no aparelho",
            "Sugere marcar amigos nas fotos comparando rostos só no seu aparelho: o modelo do rosto nunca vai para "
                    + "o Orange Social. Desligar apaga o modelo do aparelho.", "ART_11_I", true, MinorRule.UNDER_18),
    MARKETING("Novidades e ofertas da Velion e de marcas",
            "Envia novidades do ecossistema Velion e ofertas de marcas por e-mail e notificação.", "ART_7_I", false,
            MinorRule.UNDER_16),
    THIRD_PARTY_SHARING("Compartilhar com parceiros",
            "Compartilha nome e contato com parceiros do ecossistema Velion quando você usa um serviço deles. "
                    + "Dado sensível nunca é compartilhado.", "ART_7_I", false, MinorRule.NONE);

    private final String label;
    private final String description;
    private final String legalBasis;
    private final boolean sensitive;
    private final MinorRule minorRule;

    /** Idade abaixo da qual a pessoa não pode ligar a finalidade; desligar é sempre livre. */
    public enum MinorRule { NONE, UNDER_16, UNDER_18 }

    ConsentPurpose(String label, String description, String legalBasis, boolean sensitive, MinorRule minorRule) {
        this.label = label;
        this.description = description;
        this.legalBasis = legalBasis;
        this.sensitive = sensitive;
        this.minorRule = minorRule;
    }

    public String getLabel() {
        return label;
    }

    public String getDescription() {
        return description;
    }

    /** Base legal gravada no evento: Art. 7º, I ou, para dado sensível, Art. 11, I. */
    public String getLegalBasis() {
        return legalBasis;
    }

    public boolean isSensitive() {
        return sensitive;
    }

    public MinorRule getMinorRule() {
        return minorRule;
    }

    public static Optional<ConsentPurpose> fromCode(String code) {
        return Arrays.stream(values()).filter(p -> p.name().equals(code)).findFirst();
    }
}
