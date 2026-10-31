---
rf: RF27
titulo: Login, controle de sessão, controle de acesso e verificação em duas etapas (2FA)
status: parcial
numeracao_provisoria: true
cards: [OS-13, OS-47, OS-61, OS-62]
paths:
  - src/main/java/com/orangesocial/security/**
  - src/main/java/com/orangesocial/application/account/AuthService.java
  - src/main/java/com/orangesocial/application/account/MfaService.java
  - src/main/java/com/orangesocial/application/account/StepUp.java
  - src/main/java/com/orangesocial/application/account/AccountExceptions.java
  - src/main/java/com/orangesocial/application/account/AccountViews.java
  - src/main/java/com/orangesocial/application/account/AccountNotifier.java
  - src/main/java/com/orangesocial/application/account/LoggingAccountNotifier.java
  - src/main/java/com/orangesocial/domain/model/UserMfa.java
  - src/main/java/com/orangesocial/domain/model/RecoveryCode.java
  - src/main/java/com/orangesocial/infrastructure/persistence/postgres/UserMfaRepository.java
  - src/main/java/com/orangesocial/infrastructure/persistence/postgres/RecoveryCodeRepository.java
  - src/main/java/com/orangesocial/api/AuthController.java
  - src/main/java/com/orangesocial/api/MeController.java
  - src/main/java/com/orangesocial/api/ViewerResolver.java
  - src/main/java/com/orangesocial/api/ApiExceptionHandler.java
  - src/main/resources/db/migration/V3__auth_terms_mfa_deletion.sql
  - design/prototype/index.html
---

# RF27 · Login, sessão, controle de acesso e 2FA

> **Como** usuário, **quero** entrar com segurança, ver e encerrar minhas sessões e proteger a conta com um
> segundo fator **para** que ninguém use minha conta — e **sair de verdade** quando clico em "Sair" ou fecho o
> navegador, sem que uma aba anônima herde meu login.

> ⚠️ **Numeração provisória** — mesma regra de [RF24](RF24-visualizar-post.md).

| | |
|---|---|
| **Base** | OWASP Session/Authentication/MFA Cheat Sheets · NIST SP 800-63B-4 (AAL2) · RFC 6238 — detalhes em [`PESQUISA_DADOS_USUARIO.md`](../PESQUISA_DADOS_USUARIO.md) §5–6 |
| **Decisão de arquitetura** | Spring Security 7 + **sessão opaca no Valkey** (Spring Session indexado) agora; Keycloak continua o caminho para SSO entre apps Velion (ADR-09, atualizado) |
| **Status** | 🟡 Parcial — login em etapas, 2FA (TOTP + códigos de recuperação), sessões, CSRF, limite de tentativas e testes prontos; passkeys, "lembrar este navegador" e alertas por e-mail reais ainda não |

## Critérios de aceite

1. **Sessão opaca**, nunca JWT nem token em `localStorage`. O cookie de sessão:
   - não tem `Max-Age`;
   - é `HttpOnly`, `Secure` e `SameSite=Lax`;
   - em produção usa o nome `__Host-orange_session`.
2. **Aba anônima abre deslogada.** Ela tem cookies próprios e não herda a sessão da janela normal. Fechar o navegador encerra a sessão; o servidor a mata depois de 60 min ociosa ou 24 h de vida, mesmo se o navegador "restaurar" o cookie.
3. **Sair** (`POST /api/v1/auth/logout`) invalida a sessão no servidor:
   - outras abas da mesma janela recebem 401 na próxima chamada;
   - o app avisa as abas abertas via `BroadcastChannel('orange-auth')`.
4. **Login em etapas:** senha → código do 2FA, se ativo → oferta de reativação, se a conta estiver em exclusão ([RF23](RF23-direitos-titular-lgpd.md)) → sessão com **id novo**. A meia-sessão não acessa nada e expira em 5 min / 5 tentativas.
5. **Mensagens neutras** ("E-mail ou senha incorretos.") e o mesmo custo de hash para e-mail inexistente.
6. **Limite de tentativas:**
   - por conta: a partir da 5ª falha em 15 min, espera progressiva de até 15 min (`429` + `Retry-After`);
   - por IP: 20/min e 100/h.
7. **2FA por app autenticador:**
   - TOTP SHA-1, 6 dígitos, 30 s, ±1 passo, com anti-replay;
   - segredo de 160 bits cifrado com AES-256-GCM;
   - **10 códigos de recuperação** de uso único, guardados em Argon2id.
   - Ativar, regenerar e desativar exigem senha (+ código); cada mudança gera aviso por e-mail. **Sem SMS.**
   - **Uso único atômico:** o passo do TOTP e o código de recuperação são consumidos por `UPDATE` condicional no
     banco (`last_used_step < passo`; `used_at IS NULL`); com várias requisições ao mesmo tempo, só uma entra.
   - **Nunca sobrescreve o fator ativo:** confirmar uma configuração quando o 2FA já foi ligado em outra sessão dá
     `409` (`INSERT … ON CONFLICT DO NOTHING`), e o segredo que está valendo continua o mesmo.
8. **Controle de acesso:**
   - leitura de posts, perfis e Termos é pública;
   - todo o resto exige sessão;
   - escrita exige o token CSRF (`X-XSRF-TOKEN`);
   - interagir exige conta `ACTIVE` ([RF26](RF26-interacoes-post.md));
   - conta suspensa não entra.
9. **Sessões ativas:**
   - a lista mostra navegador/sistema, criação, último acesso e "esta sessão", **sem expor o id real**;
   - "Sair" encerra uma sessão e "Sair de todos os outros" encerra as demais;
   - trocar a senha encerra as outras sessões automaticamente.

## Caso de uso

```mermaid
flowchart LR
    U([Usuário]) --> L[Entrar com e-mail e senha]
    L -.2FA ativo.-> M[Digitar código do app<br/>ou código de recuperação]
    L -.conta em exclusão.-> R[Reativar conta · RF23]
    U --> O[Sair desta sessão]
    U --> S[Ver sessões ativas]
    S --> S1[Encerrar uma]
    S --> S2[Sair de todos os outros]
    U --> F[Ativar 2FA]
    F --> F1[Ler QR code / digitar chave]
    F --> F2[Guardar 10 códigos de recuperação]
    U --> D[Desativar 2FA ou gerar novos códigos<br/>senha + código]
    U --> P[Trocar senha · sai dos outros aparelhos]
    A([Aba anônima]) -.sem cookie.-> X[Visitante: só leitura]
```

## Sequência · login com 2FA

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuário
    participant APP as App
    participant API as AuthController
    participant A as AuthService
    participant VK as Valkey (limites + sessões)
    participant DB as PostgreSQL

    APP->>API: GET /api/v1/auth/csrf
    API-->>APP: cookie XSRF-TOKEN
    U->>APP: e-mail + senha
    APP->>API: POST /api/v1/auth/login (X-XSRF-TOKEN)
    API->>A: login
    A->>VK: tentativas do IP e espera da conta
    alt bloqueado
        A-->>APP: 429 + Retry-After
    end
    A->>DB: usuário por e-mail · Argon2id (hash fictício se não existir)
    alt senha errada
        A->>VK: falha++ (espera progressiva a partir da 5ª)
        A-->>APP: 401 "E-mail ou senha incorretos."
    else 2FA ativo
        A->>VK: meia-sessão {userId, MFA, 5 min, 0/5}
        A-->>APP: 200 {status: MFA_REQUIRED}
        U->>APP: código de 6 dígitos (ou xxxxx-xxxxx)
        APP->>API: POST /api/v1/auth/login/2fa
        API->>A: completeMfa
        A->>DB: decifra segredo · TOTP ±1 passo
        A->>DB: UPDATE user_mfa SET last_used_step = passo WHERE last_used_step < passo
        alt 0 linhas (código já usado, mesmo por outra requisição simultânea)
            A-->>APP: 401
        end
        A->>VK: changeSessionId · grava OrangePrincipal(id)
        A-->>APP: 200 {status: AUTHENTICATED, user}
    end
```

## Estados da sessão no navegador

```mermaid
stateDiagram-v2
    [*] --> Visitante : abre o app (ou aba anônima)
    Visitante --> SenhaConferida : senha certa + 2FA ativo
    Visitante --> Autenticada : senha certa, sem 2FA
    Visitante --> OfertaReativacao : conta em exclusão (≤ 30 dias)
    SenhaConferida --> Autenticada : código válido (id de sessão novo)
    SenhaConferida --> Visitante : 5 erros ou 5 min
    OfertaReativacao --> Autenticada : reativar
    Autenticada --> Visitante : Sair · fechar navegador · 60 min ocioso · 24 h
    Autenticada --> Visitante : encerrada em outro aparelho / troca de senha / exclusão
    note right of Autenticada
        Cookie sem Max-Age, HttpOnly, SameSite=Lax.
        Toda escrita leva X-XSRF-TOKEN.
    end note
```

## Ativar o 2FA

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuário
    participant APP as Configurações → Senha e segurança
    participant API as MeController
    participant M as MfaService
    participant DB as PostgreSQL

    U->>APP: Ativar verificação em duas etapas
    APP->>API: POST /api/v1/me/mfa/totp {password}
    API->>M: modo sudo ok → segredo 160 bits na sessão (10 min)
    API-->>APP: {secret, otpauthUri} → QR code + chave para digitar
    U->>APP: código do app autenticador
    APP->>API: POST /api/v1/me/mfa/totp/confirm {code}
    M->>DB: INSERT user_mfa … ON CONFLICT (user_id) DO NOTHING (segredo AES-256-GCM)
    alt 2FA já ligado por outra sessão
        M-->>APP: 409 "O 2FA já está ativo"
    end
    M->>DB: 10 user_recovery_code (Argon2id)
    API-->>APP: 10 códigos xxxxx-xxxxx (mostrados uma vez)
    M-->>U: e-mail "2FA ativado"
```

## Matriz de acesso

| Rota | Visitante | Sessão (conta pendente) | Sessão (conta ativa) |
|---|---|---|---|
| `GET /api/v1/posts/**`, `GET /api/v1/users/**`, `GET /api/v1/legal/**`, `GET /api/v1/backgrounds/**` | ✅ | ✅ | ✅ |
| `/api/v1/auth/**` (cadastro, login, 2FA, reativar, sair) | ✅ | ✅ | ✅ |
| `/api/v1/me/**` (perfil, preferências, sessões, 2FA, excluir) | 401 | ✅ | ✅ |
| Curtir, comentar, compartilhar, salvar | 401 | 403 | ✅ |
| Publicar, editar, arquivar, apagar post ([RF29](RF29-publicar-post.md)) | 401 | 403 | ✅ (instituição e banco só com selo conferido) |
| `POST /api/v1/media/uploads` (URL pré-assinada da foto · [RF29](RF29-publicar-post.md), [RF2](RF02-editar-perfil.md)) | 401 | 403 | ✅ |
| `PUT`/`DELETE /api/v1/me/photo` (foto de perfil, com a chave do envio) | 401 | ✅ (o `PUT` dá 422: sem conta ativa não há envio) | ✅ |
| `PUT` na URL pré-assinada (direto no bucket, fora da API) | 403 do bucket | 403 do bucket | ✅ com a assinatura recebida: até 15 min, mesmo tipo e tamanho |

## Rastreabilidade

| Camada | Artefato | Situação |
|---|---|---|
| Segurança | `SecurityConfig` (CSRF SPA, regras, cabeçalhos), `SessionService`, `AbsoluteSessionTimeoutFilter`, `LoginThrottle`, `PendingLogin`, `OrangePrincipal`, `ClientInfo`, `AppSecrets`, `SecretCipher`, `Totp`, `ProblemResponses` | ✅ |
| Aplicação | `AuthService` (login em etapas), `MfaService`, `StepUp` (modo sudo), `AccountNotifier` | ✅ |
| Concorrência do 2FA | `UserMfaRepository.consumeStep` / `enableIfAbsent` e `RecoveryCodeRepository.markUsed`: `UPDATE`/`INSERT` condicionais, 1 = aceito, 0 = já usado ou já ativo | ✅ |
| Persistência | `user_mfa`, `user_recovery_code` (V3); sessões no Valkey `orange:session` | ✅ |
| API | `/api/v1/auth/{csrf,session,register,login,login/2fa,reactivate,logout}`; `/api/v1/me/{password,sessions,mfa,…}` | ✅ |
| Testes | `TotpTest` (vetores da RFC 6238, cifra, timeout absoluto); `AuthApiIT` (aba anônima, cookie, CSRF, limite, logout entre abas, 2FA com anti-replay e códigos de recuperação, sessões; `secondFactorIsSingleUseUnderConcurrencyAndSetupNeverOverwritesAnActiveFactor`: 8 logins simultâneos com o mesmo código TOTP e de recuperação entram só uma vez, e duas configurações concorrentes dão 409 na segunda) | ✅ |
| Pendências | passkeys/WebAuthn; "lembrar este navegador por 30 dias"; e-mail transacional (OS-12); CAPTCHA após 20 falhas/24 h; SSO Velion via Keycloak (OS-13) | ⏳ OS-61, OS-62 |
| Tela | Protótipo: [13-login](../../design/prototype/screens/13-login.png) sobre o mosaico com o logo oficial, [16-login-2fa](../../design/prototype/screens/16-login-2fa.png), [17-seguranca](../../design/prototype/screens/17-seguranca.png) (2FA ativada, sessões por aparelho, "Sair" em cada uma, "Sair de todos os outros", "Sair desta conta" avisando as outras abas via `BroadcastChannel`) | ✅ protótipo |
