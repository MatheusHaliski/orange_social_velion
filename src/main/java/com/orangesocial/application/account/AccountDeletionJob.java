package com.orangesocial.application.account;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Roda todo dia de madrugada e elimina as contas cujo prazo de 30 dias para reativar terminou. */
@Component
@ConditionalOnProperty(name = "orange-social.jobs.enabled", havingValue = "true", matchIfMissing = true)
public class AccountDeletionJob {

    private static final Logger log = LoggerFactory.getLogger(AccountDeletionJob.class);

    private final AccountService accounts;

    public AccountDeletionJob(AccountService accounts) {
        this.accounts = accounts;
    }

    /** Cada conta numa transação própria: uma falha não impede as outras e é retentada no dia seguinte. */
    @Scheduled(cron = "${orange-social.account.deletion-cron:0 15 3 * * *}", zone = "America/Sao_Paulo")
    public int run() {
        int done = 0;
        for (long id : accounts.dueForElimination()) {
            try {
                accounts.eliminate(id);
                done++;
            } catch (RuntimeException e) {
                log.error("Eliminação da conta {} falhou; nova tentativa amanhã", id, e);
            }
        }
        if (done > 0) {
            log.info("Job de exclusão: {} conta(s) eliminada(s)", done);
        }
        return done;
    }
}
