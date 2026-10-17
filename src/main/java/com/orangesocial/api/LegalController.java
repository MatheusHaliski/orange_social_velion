package com.orangesocial.api;

import com.orangesocial.application.account.AccountViews.TermsView;
import com.orangesocial.application.account.LegalDocuments;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Versão vigente dos Termos de Uso da Velion, para a tela de cadastro mostrar e pedir o aceite. */
@RestController
@RequestMapping("/api/v1/legal")
public class LegalController {

    private final LegalDocuments legal;

    public LegalController(LegalDocuments legal) {
        this.legal = legal;
    }

    @GetMapping("/terms")
    public TermsView terms() {
        return new TermsView(legal.termsVersion(), legal.termsUrl());
    }
}
