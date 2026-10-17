---
rf: RF23
titulo: Direitos do titular — portabilidade e eliminação (LGPD)
status: parcial
escopo_inferido: true
cards: [OS-43, OS-44, OS-45, OS-46, OS-4A, OS-4C]
paths:
  - src/main/java/com/orangesocial/domain/model/UserControlList.java
  - src/main/java/com/orangesocial/domain/model/AccountStatus.java
  - src/main/resources/schema.sql
  - src/main/resources/db/migration/**
  - src/main/resources/cassandra/schema.cql
  - src/main/java/com/orangesocial/infrastructure/cache/redis/TrendingScoreRepository.java
  - src/main/java/com/orangesocial/application/post/PostContentEraser.java
  - src/main/java/com/orangesocial/infrastructure/persistence/postgres/PostRepository.java
  - src/main/java/com/orangesocial/infrastructure/persistence/postgres/PostCommentRepository.java
---

# RF23 · Direitos do titular — portabilidade e eliminação

> **Como** titular, **quero** baixar todos os meus dados e poder apagar minha conta **para** exercer os
> direitos que a LGPD me garante.

> ⚠️ **Escopo inferido.** A especificação cita RF23 como "LGPD Compliance & Segurança". Este documento
> cobre os controles **Exportar dados** e **Excluir conta**. Confirmar com a lista oficial de RFs.

| | |
|---|---|
| **Base legal (LGPD)** | Art. 18, V (portabilidade) · Art. 18, VI (eliminação) · Art. 16 (conservação permitida) · Art. 37 (registro das operações) |
| **Retenção legal** | Registros de acesso: 6 meses (Marco Civil, Art. 15) |
| **Status** | 🟡 Parcial — anonimização no domínio, estado terminal, `user_key` (DEK), TTLs e o passo de posts e interações (`PostContentEraser`) prontos; jobs de exportação e a orquestração da saga ainda não |

## Exportar meus dados (Art. 18, V)

```mermaid
sequenceDiagram
    autonumber
    actor T as Titular
    participant API as PrivacyController
    participant Q as Fila de jobs
    participant W as ExportWorker
    participant PG as PostgreSQL
    participant CS as Cassandra
    participant S3 as S3 (bucket privado)

    T->>API: POST /api/v1/me/export
    API->>API: step-up recente? limite 1 pedido/dia?
    API->>Q: ExportRequested
    API-->>T: 202 Accepted (acompanhe em Configurações)
    Q->>W: ExportRequested
    W->>PG: perfil + consentimentos (decifra com a DEK)
    W->>PG: posts, comentários, curtidas, salvos e compartilhamentos (RF24–RF26)
    W->>CS: posts, notificações, activity_log
    W->>S3: lista mídias do usuário
    W->>S3: PUT export-{id}.zip (JSON versionado + mídias, cifrado)
    W-->>T: notificação com URL pré-assinada (24–72 h)
    W->>CS: INSERT activity_log DATA_EXPORTED
```

## Excluir conta (Art. 18, VI) — saga idempotente

```mermaid
sequenceDiagram
    autonumber
    actor T as Titular
    participant API as PrivacyController
    participant SG as DeletionSaga
    participant VK as Valkey
    participant PG as PostgreSQL
    participant CS as Cassandra
    participant S3 as S3
    participant KMS as KMS (DEK)

    T->>API: DELETE /api/v1/me (com reautenticação)
    API->>SG: start(userId) · carência opcional de 15 dias
    SG->>VK: revoga sessões e remove do ranking (ZREM)
    SG->>PG: PostContentEraser.eraseContentOf(userId)
    Note over SG,PG: curtidas e salvos apagados · comentários sem texto ·<br/>compartilhamentos sem vínculo · posts REMOVED ·<br/>contadores dos posts de terceiros corrigidos · devolve chaves S3
    SG->>PG: anonymizeForLgpdDeletion() · status = ANONYMOUS_LGPD_DELETED
    SG->>CS: DELETE partições da timeline e notificações
    SG->>S3: DELETE objetos e versões (foto + mídias devolvidas pelo eraser)
    SG->>KMS: destrói a DEK em user_key (crypto-shredding)
    Note over SG,KMS: Backups e SSTables antigas ficam ilegíveis sem a DEK
    SG->>CS: INSERT activity_log ACCOUNT_DELETED (recibo)
    SG-->>T: e-mail de confirmação
```

## Estados da saga

```mermaid
stateDiagram-v2
    [*] --> Solicitada
    Solicitada --> EmCarencia : carência habilitada
    Solicitada --> Executando : sem carência
    EmCarencia --> Cancelada : titular desiste
    EmCarencia --> Executando : prazo vence
    Executando --> Executando : passo falhou · retry idempotente
    Executando --> Concluida : todos os passos ok + DEK destruída
    Concluida --> [*]
    Cancelada --> [*]
    note right of Executando
        Reconciliação diária reprocessa passos pendentes
        e reaplica exclusões depois de qualquer restore.
    end note
```

Ciclo de vida da conta: [`MAQUINA_ESTADOS.md`](../MAQUINA_ESTADOS.md) (estado terminal `Anonymous_LGPD_Deleted`).

## Rastreabilidade

| Camada | Artefato | Situação |
|---|---|---|
| Domínio | `UserControlList.anonymizeForLgpdDeletion`, `AccountStatus` (terminal) | ✅ |
| Persistência | `user_key` (DEK), TTL em `post_timeline`/`notification`, `TrendingScoreRepository.remove` | ✅ |
| Posts e interações | `PostContentEraser` + consultas de eliminação em `PostRepository` / `PostCommentRepository` (idempotente) | ✅ |
| Testes | `DomainModelTest.lgpdDeletionIsTerminalAndErasesPersonalData`, `TrendingScoreRepositoryIT.removeClearsEveryRankingOfTheFeed`, `PostApiIT.lgpdErasureRemovesContentAndFixesOtherPostsCounters` | ✅ |
| Perfil público | conta eliminada some do perfil público e aparece como "Conta excluída" sem link ([RF25](RF25-perfil-publico-autor.md)) | ✅ |
| Exportação | job + ZIP cifrado + URL pré-assinada | ⏳ OS-43 |
| Exclusão | saga + reconciliação + crypto-shredding | ⏳ OS-44, OS-46 |
| Auditoria | registro de operações (Art. 37) | ⏳ OS-45, OS-4A |
| Tela | Protótipo: [Configurações → Seus dados](../../design/prototype/screens/05-config-lgpd.png) | ✅ protótipo |
