---
rf: RF3
titulo: Gerenciar consentimentos e privacidade
status: parcial
escopo_inferido: true
cards: [OS-16, OS-40, OS-41, OS-42, OS-48, OS-49]
paths:
  - src/main/resources/schema.sql
  - src/main/resources/db/migration/**
  - design/prototype/index.html
---

# RF3 · Gerenciar consentimentos e privacidade

> **Como** titular, **quero** ligar e desligar cada uso opcional dos meus dados **para** autorizar só o que
> eu quiser e revogar a qualquer momento.

> ⚠️ **Escopo inferido.** A especificação lista RF3 entre os RFs de LGPD sem descrevê-lo. Este documento
> assume que RF3 cobre os toggles de consentimento da tela de configurações. Confirmar com a lista oficial.

| | |
|---|---|
| **Base legal (LGPD)** | Art. 7º, I (consentimento) · Art. 8º, §5º (revogação facilitada) · Art. 11 (dado sensível) |
| **Princípio** | Privacy by Default — todo tratamento opcional começa **desligado** |
| **Status** | 🟡 Parcial — tabela `consent_event` (append-only) e view `user_consent_current` prontas; API e efeitos ainda não |

## Finalidades e regras

| Finalidade (`purpose`) | Base | Padrão | Bloqueios |
|---|---|---|---|
| `LOCATION_TRACKING` | Art. 7º, I | desligado | menores (ECA Digital) |
| `PERSONALIZED_FEED` | Art. 7º, I | desligado | menores: sem perfilamento |
| `MARKETING` | Art. 7º, I | desligado | menores |
| `FACIAL_RECOGNITION` | Art. 11, I | desligado | menores; processamento só no aparelho |
| `SENSITIVE_PROFILE_DATA` | Art. 11, I | desligado | — |
| `THIRD_PARTY_SHARING` | Art. 7º, I | desligado | — |

## Estados de um consentimento

```mermaid
stateDiagram-v2
    [*] --> NaoConcedido : cadastro (RF1)
    NaoConcedido --> Concedido : titular liga o toggle
    Concedido --> Revogado : titular desliga (mesmo toque)
    Revogado --> Concedido : titular liga de novo
    Concedido --> Reconsentir : nova versão da política
    Reconsentir --> Concedido : aceita a nova versão
    Reconsentir --> Revogado : recusa
    NaoConcedido --> Bloqueado : conta de menor (ECA Digital)
    Bloqueado --> NaoConcedido : maioridade confirmada
    note right of Revogado
        Cada transição é uma nova linha em consent_event.
        Nada é apagado: o histórico prova o consentimento (Art. 8º §2º).
    end note
```

## Sequência — revogar localização

```mermaid
sequenceDiagram
    autonumber
    actor T as Titular (app)
    participant API as ConsentController
    participant DB as PostgreSQL
    participant OB as outbox_event
    participant U as Consumidores (perfil, alertas, feed)

    T->>API: PUT /api/v1/me/consents/LOCATION_TRACKING {granted: false}
    API->>DB: BEGIN
    API->>DB: INSERT consent_event (granted=false, policy_version, canal, ip_hash)
    API->>OB: INSERT ConsentRevoked {purpose: LOCATION_TRACKING}
    API->>DB: COMMIT
    API-->>T: 200 (efeito imediato)
    OB-->>U: ConsentRevoked
    U->>DB: UPDATE "VSusercontrolist" SET last_saved_location = NULL
    U->>U: para de usar a localização em filtros e alertas
```

## Rastreabilidade

| Camada | Artefato | Situação |
|---|---|---|
| Persistência | `consent_event`, view `user_consent_current` (`schema.sql`) | ✅ |
| API | `GET/PUT /api/v1/me/consents/{purpose}` | ⏳ OS-40, OS-41 |
| Efeitos | consumidores de `ConsentRevoked` | ⏳ OS-16, OS-42 |
| Menores | bloqueio por idade | ⏳ OS-49 |
| Tela | Protótipo: [Configurações → Privacidade](../../design/prototype/screens/05-config-lgpd.png) | ✅ protótipo |
