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
  - src/main/java/com/orangesocial/application/account/AccountService.java
  - src/main/java/com/orangesocial/application/account/AccountDeletionJob.java
  - src/main/java/com/orangesocial/infrastructure/persistence/postgres/PostRepository.java
  - src/main/java/com/orangesocial/infrastructure/persistence/postgres/PostCommentRepository.java
  - design/prototype/index.html
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
| **Exclusão com carência** | Modal explica as consequências e pede senha (+2FA) e confirmação; a conta fica `PENDING_DELETION` por **30 dias** (oculta, todas as sessões encerradas); entrar de novo no prazo oferece **reativar**; vencido o prazo, o job diário elimina |
| **Status** | 🟡 Parcial — carência de 30 dias com reativação, job de eliminação (posts, interações, 2FA, preferências, anonimização), `user_key` (DEK) e TTLs prontos; exportação, S3, Cassandra e destruição da DEK na saga ainda não |

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

## Excluir conta — modal, carência de 30 dias e reativação

O modal (`role="alertdialog"`, foco inicial em **Cancelar**) diz, antes de confirmar:

- **O que será apagado:** perfil, publicações, fotos, comentários, curtidas, seguidores e configurações.
- **O que continua existindo:**
  - mensagens enviadas ficam com quem recebeu, como "Conta excluída";
  - registros de acesso são guardados por 6 meses (Marco Civil, art. 15).
- **Como reativar:** entrar de novo antes de DD/MM.
- **Antes de excluir:** link para baixar uma cópia dos dados.

Confirmar exige marcar "Entendo as consequências" e digitar a senha (e o código, com 2FA).

```mermaid
sequenceDiagram
    autonumber
    actor T as Titular
    participant APP as App (modal)
    participant API as MeController
    participant AC as AccountService
    participant VK as Valkey (sessões)
    participant DB as PostgreSQL

    T->>APP: Seus dados → Excluir conta
    APP-->>T: modal: consequências, prazo de 30 dias, baixar dados, senha
    T->>APP: marca "entendo" + senha (+ código 2FA)
    APP->>API: POST /api/v1/me/deletion {password, code, confirm: true}
    API->>API: modo sudo (senha + 2FA)
    API->>AC: requestDeletion
    AC->>DB: status PENDING_DELETION · deletion_scheduled_for = agora + 30 dias
    AC->>VK: apaga todas as sessões do usuário (inclusive esta)
    API-->>APP: 202 {deletionScheduledFor, graceDays: 30}
    Note over T,DB: Perfil e posts somem dos feeds na hora (autor não ACTIVE)
    T->>API: (dia 12) POST /api/v1/auth/login
    API-->>APP: {status: REACTIVATION_AVAILABLE, deletionScheduledFor}
    T->>API: POST /api/v1/auth/reactivate
    API->>DB: volta ao status anterior · limpa as datas
    API-->>APP: 200 AUTHENTICATED
```

## Eliminação depois do prazo — saga idempotente

```mermaid
sequenceDiagram
    autonumber
    participant JOB as AccountDeletionJob (03:15)
    participant SG as AccountService.eliminate
    participant VK as Valkey
    participant PG as PostgreSQL
    participant CS as Cassandra
    participant S3 as S3
    participant KMS as KMS (DEK)

    JOB->>SG: contas PENDING_DELETION com prazo vencido (uma transação cada)
    SG->>VK: revoga sessões e remove do ranking (ZREM)
    SG->>PG: PostContentEraser.eraseContentOf(userId)
    Note over SG,PG: curtidas e salvos apagados · comentários sem texto ·<br/>compartilhamentos sem vínculo · posts REMOVED ·<br/>contadores dos posts de terceiros corrigidos · devolve chaves S3
    SG->>PG: apaga 2FA, códigos de recuperação e preferências
    SG->>PG: anonymizeForLgpdDeletion() · status = ANONYMOUS_LGPD_DELETED (sem @, sem type_details)
    SG->>CS: DELETE partições da timeline e notificações
    SG->>S3: DELETE objetos e versões (foto + mídias devolvidas pelo eraser)
    SG->>KMS: destrói a DEK em user_key (crypto-shredding)
    Note over SG,KMS: Backups e SSTables antigas ficam ilegíveis sem a DEK
    SG->>CS: INSERT activity_log ACCOUNT_DELETED (recibo)
```

## Estados da saga

```mermaid
stateDiagram-v2
    [*] --> EmCarencia : titular confirma no modal (senha + 2FA)
    EmCarencia --> Cancelada : titular entra e reativa (≤ 30 dias)
    EmCarencia --> Executando : prazo de 30 dias vence (job diário)
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
| Posts e interações | `PostContentEraser` + consultas de eliminação em `PostRepository` / `PostCommentRepository` (idempotente); a eliminação também apaga a moldura (`post.background`, V4 · [RF28](RF28-moldura-post.md)) | ✅ |
| Testes | `DomainModelTest.lgpdDeletionIsTerminalAndErasesPersonalData`, `TrendingScoreRepositoryIT.removeClearsEveryRankingOfTheFeed`, `PostApiIT.lgpdErasureRemovesContentAndFixesOtherPostsCounters` (inclui a moldura) | ✅ |
| Perfil público | conta eliminada some do perfil público e aparece como "Conta excluída" sem link ([RF25](RF25-perfil-publico-autor.md)) | ✅ |
| Exportação | job + ZIP cifrado + URL pré-assinada | ⏳ OS-43 |
| Exclusão com carência | `UserControlList.requestDeletion/reactivate`, `AccountService.requestDeletion/eliminate`, `AccountDeletionJob`, `POST /api/v1/me/deletion`, `POST /api/v1/auth/reactivate` | ✅ |
| Testes da carência | `AccountRulesTest.deletionGraceAllowsReactivationOnlyWithinTheWindow`, `AuthApiIT.deletionHidesAccountAllowsReactivationWithin30DaysAndEliminatesAfter` | ✅ |
| Exclusão — passos fora do PostgreSQL | S3, Cassandra, Valkey (ranking), destruição da DEK, reconciliação | ⏳ OS-44, OS-46 |
| Auditoria | registro de operações (Art. 37) | ⏳ OS-45, OS-4A |
| Tela | Protótipo: [Configurações → Seus dados](../../design/prototype/screens/05-config-lgpd.png); modal de exclusão [19-excluir-conta](../../design/prototype/screens/19-excluir-conta.png) (`alertdialog` com consequências, data final, "Baixar uma cópia", caixa "Entendo" + senha + código; o botão só habilita após marcar); oferta de reativação no login [20-reativar-conta](../../design/prototype/screens/20-reativar-conta.png) | ✅ protótipo |
