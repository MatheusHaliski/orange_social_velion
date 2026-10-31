---
rf: RF1
titulo: Cadastro de usuário (VSusercontrolist) com tipo de usuário e aceite dos Termos de Uso
status: parcial
cards: [OS-10, OS-11, OS-12, OS-17, OS-49, OS-60]
paths:
  - src/main/java/com/orangesocial/domain/model/UserControlList.java
  - src/main/java/com/orangesocial/domain/model/UserCategoryEnum.java
  - src/main/java/com/orangesocial/domain/model/AccountStatus.java
  - src/main/java/com/orangesocial/domain/model/CategoryVerification.java
  - src/main/java/com/orangesocial/domain/model/Cnpj.java
  - src/main/java/com/orangesocial/domain/model/TermsAcceptance.java
  - src/main/java/com/orangesocial/application/account/RegistrationService.java
  - src/main/java/com/orangesocial/application/account/UserTypeDetailsValidator.java
  - src/main/java/com/orangesocial/application/account/AgePolicy.java
  - src/main/java/com/orangesocial/application/account/PasswordPolicy.java
  - src/main/java/com/orangesocial/application/account/EmailVerificationService.java
  - src/main/java/com/orangesocial/application/account/LegalDocuments.java
  - src/main/java/com/orangesocial/api/AuthController.java
  - src/main/java/com/orangesocial/api/LegalController.java
  - src/main/java/com/orangesocial/infrastructure/persistence/postgres/UserControlListRepository.java
  - src/main/java/com/orangesocial/infrastructure/persistence/postgres/TermsAcceptanceRepository.java
  - src/main/resources/schema.sql
  - src/main/resources/db/migration/V1__baseline.sql
  - src/main/resources/db/migration/V3__auth_terms_mfa_deletion.sql
  - design/prototype/index.html
---

# RF1 · Cadastro de usuário

> **Como** visitante, **quero** criar uma conta escolhendo meu tipo de usuário (uma das 6 cores) e aceitando
> os Termos de Uso da Velion **para** publicar e ser encontrado nos feeds com a cor certa.

| | |
|---|---|
| **Base legal (LGPD)** | Art. 7º, V (execução de contrato) para os dados do cadastro e o aceite dos Termos; Art. 7º, I (consentimento) para os usos opcionais — todos começam desligados ([RF3](RF03-consentimento-privacidade.md)) |
| **Termos de Uso** | Texto da Velion (dona do Orange Social) em [`docs/legal/TERMOS_DE_USO.md`](../legal/TERMOS_DE_USO.md), com marcadores `{{…}}` para os dados da empresa; aceite obrigatório, caixa desmarcada |
| **ECA Digital** | Mínimo 13 anos; menor de 16 informa o e-mail do responsável e nasce com proteções travadas; organizações exigem responsável 18+ |
| **Campos por tipo** | [`PESQUISA_DADOS_USUARIO.md`](../PESQUISA_DADOS_USUARIO.md) §3 — validados por `UserTypeDetailsValidator` |
| **Status** | 🟡 Parcial — API, regras, verificação de e-mail testes e protótipo prontos; envio real de e-mail (OS-12), vínculo completo com o responsável (OS-49) e telas no app (OS-39) ainda não |

## Critérios de aceite

1. Dados mínimos: nome de exibição, `@usuário` único (3–30, `a-z 0-9 . _`), e-mail único (minúsculas),
   senha de 12 a 128 caracteres (Argon2id), data de nascimento, **tipo de usuário** e aceite da **versão vigente**
   dos Termos de Uso da Velion.
2. Campos específicos do tipo em `type_details`; chave fora da lista é recusada (minimização).
   CNPJ aceita o formato **alfanumérico** (IN RFB 2.229/2024).
3. VERMELHO e PRETO/banco nascem com selo `PENDING` (verificação manual antes de publicar).
4. Idade: < 13 recusado; < 16 exige `guardianEmail` e preferências protetivas; tipo diferente de VERDE exige 18+.
5. Na mesma transação: usuário `PENDING_VERIFICATION`, linha em `terms_acceptance` (versão, canal, HMAC do IP),
   **6 consentimentos com `granted = false`** e preferências padrão.
6. O cadastro já abre a sessão; um código de 6 dígitos vai por e-mail (30 min, 5 tentativas, reenvio 1/min)
   e confirmar leva a conta a `ACTIVE`. Sem confirmar, a pessoa lê mas não interage (403).
7. Todos os erros de validação voltam juntos (`422` com `errors[]`) para o formulário marcar cada campo.
8. **Cadastros simultâneos** com o mesmo e-mail ou `@usuário` (duas abas, clique duplo, robô): todos passam pela
   checagem prévia, mas as chaves únicas do banco (`uk_vsusercontrolist_email`, `uk_vsusercontrolist_handle`) deixam
   entrar só um; os outros recebem `409`, nunca `500`, e nada fica gravado pela metade.

## Caso de uso

```mermaid
flowchart LR
    V([Visitante]) --> UC1[Criar conta]
    UC1 --> UC2[Escolher tipo de usuário<br/>6 cores · glifo · rótulo]
    UC2 --> UC3[Preencher campos do tipo<br/>CNPJ, veículo, comunidade, evento…]
    UC1 --> UC4[Ler e aceitar os Termos de Uso da Velion]
    UC1 --> UC5[Confirmar e-mail com código]
    UC1 -.menor de 16.-> UC6[Informar e-mail do responsável<br/>ECA Digital]
    MOD([Moderação]) --> UC7[Verificar VERMELHO e bancos<br/>CNPJ · domínio · representante]
    UC2 -.VERMELHO ou PRETO/banco.-> UC7
```

## Sequência

```mermaid
sequenceDiagram
    autonumber
    actor V as Visitante (app)
    participant API as AuthController
    participant R as RegistrationService
    participant DB as PostgreSQL
    participant VK as Valkey
    participant N as AccountNotifier (e-mail)

    V->>API: GET /api/v1/legal/terms · GET /api/v1/auth/csrf
    API-->>V: versão vigente dos Termos + cookie XSRF-TOKEN
    V->>API: POST /api/v1/auth/register {nome, @, e-mail, senha, tipo, nascimento, aceite, versão, typeDetails}
    API->>R: register(cmd, canal, HMAC do IP)
    R->>R: termos? idade? senha? campos do tipo? (todos os erros juntos)
    alt inválido
        R-->>V: 422 {errors: [...]}
    else e-mail ou @ em uso
        R-->>V: 409
    else ok
        R->>DB: BEGIN
        R->>DB: INSERT "VSusercontrolist" (PENDING_VERIFICATION, type_details, selo)
        alt outro cadastro com o mesmo e-mail ou @ entrou antes (corrida)
            DB-->>R: violação de chave única (23505) · ROLLBACK
            R-->>V: 409 (ApiExceptionHandler)
        end
        R->>DB: INSERT terms_acceptance (TERMS_OF_USE, 2026-10-17)
        R->>DB: INSERT consent_event × 6 (granted = false)
        R->>DB: INSERT user_preference (padrões · protetivos se menor de 16)
        R->>DB: COMMIT
        R->>VK: HSET auth:verify:{id} (HMAC do código, TTL 30 min)
        R->>N: código de 6 dígitos
        API->>VK: cria a sessão (id novo, cookie sem Max-Age)
        API-->>V: 201 {status: AUTHENTICATED, user: {accountStatus: PENDING_VERIFICATION}}
    end
    V->>API: POST /api/v1/me/verify-email {code}
    API-->>V: 200 {accountStatus: ACTIVE, emailVerified: true}
```

## Atividades — regras por tipo de usuário

```mermaid
flowchart TD
    A[Formulário enviado] --> T{Aceitou os Termos<br/>da versão vigente?}
    T -- não --> E[422]
    T -- sim --> I{Idade}
    I -- "< 13" --> E
    I -- "13 a 15" --> G{guardianEmail informado<br/>e tipo = VERDE?}
    G -- não --> E
    G -- sim --> P[Preferências protetivas travadas]
    I -- "16 a 17" --> V{tipo = VERDE?}
    V -- não --> E
    I -- "18+" --> K
    V -- sim --> K
    P --> K{Tipo escolhido}
    K -- VERDE --> K1[opcionais: cidade, site, ocupação]
    K -- AMARELO --> K2[subtipo, veículo, site, função · MTb e CNPJ opcionais]
    K -- AZUL --> K3[CNPJ, razão social, site, segmento, responsável]
    K -- LARANJA --> K4[tipo de comunidade, cidade/UF, responsável · CNPJ opcional]
    K -- VERMELHO --> K5[subtipo, CNPJ, razão social, site, setor, representante]
    K -- PRETO --> K6[subtipo, organizador · evento: nome, data, local · banco: CNPJ + código BCB]
    K1 & K2 & K3 & K4 --> S1[selo NOT_REQUIRED]
    K5 --> S2[selo PENDING]
    K6 -- banco --> S2
    K6 -- outros --> S1
    S1 & S2 --> OK[(Grava na mesma transação)]
```

## Modelo de dados envolvido

```mermaid
erDiagram
    VSusercontrolist ||--o{ consent_event : "6 finalidades, todas false no cadastro"
    VSusercontrolist ||--o{ terms_acceptance : "aceita (append-only)"
    VSusercontrolist ||--|| user_preference : configura
    VSusercontrolist ||--o| user_key : "DEK (crypto-shredding)"
    VSusercontrolist ||--o{ post : "publica (RF24–RF26)"
    VSusercontrolist {
        bigint id PK
        varchar email UK
        varchar handle UK "@usuário"
        varchar password_hash "Argon2id"
        varchar user_type "VERDE..PRETO"
        jsonb type_details "campos do tipo"
        varchar category_verification "NOT_REQUIRED PENDING VERIFIED REJECTED"
        varchar account_status
        date user_date_of_birth
        timestamptz email_verified_at
    }
    terms_acceptance {
        bigint id PK
        bigint user_id FK
        varchar document "TERMS_OF_USE"
        varchar version
        timestamptz accepted_at
        varchar channel
        varchar ip_hash "HMAC"
    }
    consent_event {
        bigint id PK
        bigint user_id FK
        varchar purpose
        boolean granted
        varchar policy_version
    }
```

Fluxo de atividades geral do cadastro: [`DIAGRAMA_ATIVIDADES.md`](../DIAGRAMA_ATIVIDADES.md) · estados da conta:
[`MAQUINA_ESTADOS.md`](../MAQUINA_ESTADOS.md) · login e sessão: [RF27](RF27-autenticacao-sessao.md).

## Rastreabilidade

| Camada | Artefato | Situação |
|---|---|---|
| Domínio | `UserControlList` (e-mail normalizado, `markEmailVerified`), `CategoryVerification`, `Cnpj`, `TermsAcceptance` | ✅ |
| Regras | `RegistrationService`, `UserTypeDetailsValidator`, `AgePolicy`, `PasswordPolicy`, `EmailVerificationService`, `LegalDocuments` | ✅ |
| Persistência | `V1__baseline.sql`, `V3__auth_terms_mfa_deletion.sql` (handle, type_details, selo, `terms_acceptance`) | ✅ |
| API | `POST /api/v1/auth/register`, `GET /api/v1/legal/terms`, `POST /api/v1/me/verify-email` (+ `/resend`), `POST /api/v1/me/terms` | ✅ |
| Testes | `AccountRulesTest` (CNPJ alfanumérico, senha, campos por tipo), `AuthApiIT.registerWithChosenTypeAndTermsStartsASessionThatAnIncognitoWindowDoesNotSee`, `AuthApiIT.registrationRulesTermsTypeFieldsAgeAndUniqueness`, `AuthApiIT.minorsKeepProtectiveDefaults`, `AuthApiIT.simultaneousRegistrationsWithTheSameEmailOrHandleCreateOneAccountAndTheRestGet409` (6 cadastros ao mesmo tempo: um 201, o resto 409) | ✅ |
| Corrida | `ApiExceptionHandler.race`: chave única violada (SQLState 23505) ou lock otimista → `409`; CHECK ou FK violado continua `500` e vai para o log | ✅ |
| Termos | [`docs/legal/TERMOS_DE_USO.md`](../legal/TERMOS_DE_USO.md) — preencher os `{{…}}` e passar por revisão jurídica | 🟡 |
| Pendências | e-mail transacional real (OS-12); eliminar cadastro não confirmado em 7 dias; vínculo do responsável (OS-49); consulta automática de CNPJ | ⏳ |
| Tela | Protótipo sobre o mosaico laranja com o logo oficial: [14-cadastro](../../design/prototype/screens/14-cadastro.png) (dados + escolha do tipo, cor + glifo + rótulo) e [15-cadastro-termos](../../design/prototype/screens/15-cadastro-termos.png) (campos do tipo + caixa dos Termos **desmarcada**; "Criar conta" só habilita depois do aceite) | ✅ protótipo |
| App | telas em Next.js/Expo | ⏳ OS-39 |
