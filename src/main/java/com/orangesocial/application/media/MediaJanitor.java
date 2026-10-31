package com.orangesocial.application.media;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.Collection;
import java.util.List;
import java.util.Objects;

/**
 * Apaga objetos do bucket presos ao destino da transação do banco: o que o banco deixou de referenciar sai depois do
 * commit; o que foi gravado para uma transação que voltou atrás sai no rollback. Melhor esforço: falha vira aviso no
 * log e o objeto fica para a regra de expiração do bucket ou para a próxima limpeza.
 */
@Component
public class MediaJanitor {

    private static final Logger log = LoggerFactory.getLogger(MediaJanitor.class);

    private final MediaStorage storage;

    public MediaJanitor(MediaStorage storage) {
        this.storage = storage;
    }

    public void deleteAfterCommit(Collection<String> objectKeys) {
        List<String> keys = objectKeys.stream().filter(Objects::nonNull).toList();
        if (keys.isEmpty()) {
            return;
        }
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            deleteAll(keys);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                deleteAll(keys);
            }
        });
    }

    public void deleteOnRollback(String objectKey) {
        if (objectKey == null || !TransactionSynchronizationManager.isSynchronizationActive()) {
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) {
                    deleteAll(List.of(objectKey));
                }
            }
        });
    }

    void deleteAll(List<String> keys) {
        for (String key : keys) {
            try {
                storage.delete(key);
            } catch (RuntimeException e) {
                log.warn("Não foi possível apagar o objeto {} do bucket: {}", key, e.getMessage());
            }
        }
    }
}
