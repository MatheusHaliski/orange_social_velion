package com.orangesocial.application.account;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Versão vigente dos Termos de Uso da Velion (empresa dona do Orange Social) e onde lê-los.
 * O texto fica em docs/legal/TERMOS_DE_USO.md; publicar uma versão nova = mudar
 * {@code orange-social.legal.terms-version} — quem aceitou a anterior aceita de novo no próximo login.
 */
@Component
public class LegalDocuments {

    private final String termsVersion;
    private final String termsUrl;
    private final String privacyVersion;

    public LegalDocuments(@Value("${orange-social.legal.terms-version}") String termsVersion,
                          @Value("${orange-social.legal.terms-url}") String termsUrl,
                          @Value("${orange-social.legal.privacy-version}") String privacyVersion) {
        this.termsVersion = termsVersion;
        this.termsUrl = termsUrl;
        this.privacyVersion = privacyVersion;
    }

    public String termsVersion() {
        return termsVersion;
    }

    public String termsUrl() {
        return termsUrl;
    }

    public String privacyVersion() {
        return privacyVersion;
    }
}
