---
rf: RF2
titulo: Editar informações pessoais e preferências do perfil
status: parcial
cards: [OS-14, OS-15, OS-18, OS-19]
paths:
  - src/main/java/com/orangesocial/domain/model/UserControlList.java
  - src/main/java/com/orangesocial/domain/model/CommunityInterest.java
  - src/main/java/com/orangesocial/domain/model/GeoLocation.java
  - design/prototype/index.html
---

# RF2 · Editar informações pessoais e preferências do perfil

> **Como** titular, **quero** corrigir meus dados e ajustar minhas preferências **para** manter meu perfil
> exato e decidir o que o app usa sobre mim.

Este é o RF citado no material de LGPD: o comportamento do sistema é, ao mesmo tempo, o **direito de
correção** do titular.

| | |
|---|---|
| **Base legal (LGPD)** | Art. 18, III — correção de dados incompletos, inexatos ou desatualizados |
| **Controles de UI** | Inputs editáveis → Art. 18, III; preferências com efeito de consentimento → [RF3](RF03-consentimento-privacidade.md) |
| **Status** | 🟡 Parcial — modelo e tela de configurações prototipados; endpoint e auditoria ainda não |

## Critérios de aceite

1. Todos os 19 campos de `VSusercontrolist` são editáveis pelo titular, exceto `id` e o histórico.
2. Trocar **e-mail** ou **senha** exige reautenticação recente (step-up, OS-19).
3. Comunidades seguem a cadeia `typeofcommunity → selectcountry → selectcity` (OS-15).
4. Foto é trocada por URL pré-assinada; o banco guarda só `photo_object_key` (OS-18).
5. Cada alteração gera evento em `activity_log` **sem o valor em claro** (prestação de contas).

## Sequência

```mermaid
sequenceDiagram
    autonumber
    actor T as Titular (app)
    participant API as ProfileController
    participant S as ProfileService
    participant DB as PostgreSQL
    participant OB as outbox_event
    participant LOG as Cassandra activity_log

    T->>API: PATCH /api/v1/me {campos alterados}
    API->>API: valida formato (e-mail, E.164, ISO 3166)
    alt altera e-mail ou senha
        API->>API: exige step-up (max_age ≤ 5 min)
        API-->>T: 401 step_up_required (se expirado)
    end
    API->>S: update(userId, patch)
    S->>DB: BEGIN · UPDATE "VSusercontrolist" (version++)
    alt conflito de versão
        S-->>T: 409 (perfil alterado em outro aparelho)
    else ok
        S->>OB: INSERT ProfileUpdated {campos: ["city", ...]}
        S->>DB: COMMIT
        S-->>T: 200 perfil atualizado
        OB-->>LOG: PROFILE_UPDATED (nomes dos campos, sem valores)
    end
```

## Atividades — o que muda junto com cada campo

```mermaid
flowchart TD
    A[Titular salva alterações] --> B{Campo alterado}
    B -- e-mail --> C[Step-up + novo código de verificação]
    B -- cidade / país --> D[Reindexa filtros Local/País/Cidade]
    B -- Usertype --> E{Nova cor é VERMELHO ou PRETO?}
    E -- sim --> F[Volta para verificação manual<br/>selo suspenso]
    E -- não --> G[Atualiza cor nos próximos posts]
    B -- foto --> H[Upload S3 + apaga objeto antigo]
    B -- sexualpreference --> I{Consentimento SENSITIVE_PROFILE_DATA?}
    I -- não --> J[Bloqueia e pede consentimento · RF3]
    I -- sim --> K[Grava cifrado com a DEK do usuário]
    C & D & F & G & H & K --> L[(UPDATE + outbox ProfileUpdated)]
```

## Rastreabilidade

| Camada | Artefato | Situação |
|---|---|---|
| Domínio | setters de `UserControlList`, `CommunityInterest`, `GeoLocation` (validação de lat/lng) | ✅ |
| Testes | `DomainModelTest.geoLocationRejectsInvalidCoordinates` | ✅ parcial |
| API | `PATCH /api/v1/me`, step-up | ⏳ OS-14, OS-19 |
| Auditoria | `activity_log` (Cassandra) | ⏳ OS-45 |
| Tela | Protótipo: [Configurações → Dados do perfil](../../design/prototype/screens/05-config-lgpd.png) | ✅ protótipo |
