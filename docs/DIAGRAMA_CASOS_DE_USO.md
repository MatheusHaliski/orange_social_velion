# Diagrama de Casos de Uso — Orange Social

Visão do sistema pelos **atores** ([taxonomia, §1](TAXONOMIA_ATORES_E_CARDS.md#1-atores)) e pelo que cada um
consegue fazer. Cada RF tem o seu caso de uso detalhado em `docs/rf/`; aqui ficam o mapa geral e as relações
entre os casos.

**Como ler.** Mermaid não tem notação UML de caso de uso, então a convenção é:

| Elemento UML | Aqui |
|---|---|
| Ator | retângulo laranja com o nome em negrito; **principais à esquerda**, de apoio e de sistema à direita |
| Caso de uso | cápsula (oval) |
| Fronteira do sistema | implícita: toda cápsula está dentro do Orange Social; atores ficam fora, nas laterais (a moldura foi omitida porque o Mermaid desorganiza o layout quando há ligações cruzando um `subgraph`) |
| Associação ator–caso | linha contínua |
| `«include»` (sempre acontece junto) | seta tracejada com `«include»` |
| `«extend»` (só em certa condição) | seta tracejada com `«extend»` e a condição |
| Generalização entre atores | ver [diagrama de classes de atores](TAXONOMIA_ATORES_E_CARDS.md#11-hierarquia-de-atores) |
| Situação | cápsula contínua = implementado ✅ · tracejada = planejado ⏳ |

---

## 1. Visão geral (pacotes)

```mermaid
flowchart LR
    VIS["Visitante"]:::actor
    USR["Usuário ativo"]:::actor
    TIT["Titular"]:::actor
    RESP["Responsável legal"]:::actor
    FONTE["Fonte oficial<br/>VERMELHO verificado"]:::actor
    MOD["Moderação"]:::actor
    ENC["Encarregado (DPO)"]:::actor
    SIS["Sistema<br/>jobs · expiração · limites · e-mail"]:::actor
    VEL["Módulos Velion"]:::actor
    ANPD["ANPD"]:::actor

    P1(["Conta e acesso<br/>RF1 · RF27"])
    P2(["Perfil e preferências<br/>RF2"])
    P3(["Privacidade e direitos do titular<br/>RF3 · RF23"])
    P4(["Feeds e conteúdo<br/>RF24 · RF25 · OS-23"])
    P5(["Interações<br/>RF26"])
    P6(["Alertas e vagas<br/>Alert Feed"]):::planned
    P7(["Moderação e selo"]):::planned
    P8(["Integração Velion<br/>SSO · pontos · troféus"]):::planned
    P9(["Moldura do post<br/>RF28"]):::planned

    VIS --- P1 & P4
    USR --- P1 & P2 & P4 & P5 & P9
    TIT --- P3
    FONTE --- P6
    P3 -.- RESP
    P3 --- ENC
    P3 -.- ANPD
    P1 & P3 --- SIS
    P7 --- MOD
    P8 --- VEL

    classDef actor fill:#FFF1E8,stroke:#FF6A2B,stroke-width:2px,color:#17120D,font-weight:bold
    classDef planned stroke-dasharray:5 4
```

---

## 2. Conta e acesso (RF1 · RF27)

### 2.1 Cadastro e entrada

```mermaid
flowchart LR
    VIS["Visitante"]:::actor
    MEN["Menor de 16"]:::actor
    PEN["Usuário pendente"]:::actor

    CAD(["Criar conta ✅"])
    ENT(["Entrar ✅"])
    CONF(["Confirmar e-mail com código ✅"])
    PASS(["Entrar com passkey ⏳"]):::planned
    TIPO(["Escolher tipo de usuário ✅"])
    CAMPOS(["Preencher campos do tipo ✅"])
    TERMOS(["Aceitar Termos de Uso da Velion ✅"])
    GUARD(["Informar e-mail do responsável ✅"])
    DOIS(["Informar código do 2FA<br/>ou de recuperação ✅"])
    REAT(["Reativar conta em exclusão ✅"])
    LIM(["Limitar tentativas ✅"])
    AVISO(["Enviar código ou aviso por e-mail 🟡"])

    THR["LoginThrottle"]:::actor
    NOT["AccountNotifier"]:::actor

    VIS --- CAD & ENT & PASS
    MEN --- CAD
    PEN --- CONF
    CAD -. «include» .-> TIPO
    TIPO -. «include» .-> CAMPOS
    CAD -. «include» .-> TERMOS
    CAD -. «include» .-> AVISO
    GUARD -. «extend» menor de 16 .-> CAD
    CONF -. «include» .-> AVISO
    ENT -. «include» .-> LIM
    DOIS -. «extend» 2FA ativo .-> ENT
    REAT -. «extend» conta em exclusão .-> ENT
    LIM --- THR
    AVISO --- NOT

    classDef actor fill:#FFF1E8,stroke:#FF6A2B,stroke-width:2px,color:#17120D,font-weight:bold
    classDef planned stroke-dasharray:5 4
```

### 2.2 Sessões, senha e 2FA

```mermaid
flowchart LR
    USR["Usuário<br/>pendente ou ativo"]:::actor

    SAIR(["Sair ✅"])
    SES(["Ver sessões ativas ✅"])
    ENC1(["Encerrar uma sessão ✅"])
    ENCT(["Sair de todos os outros aparelhos ✅"])
    SENHA(["Trocar senha ✅"])
    ATV(["Ativar 2FA ✅"])
    COD(["Gerar novos códigos de recuperação ✅"])
    DES(["Desativar 2FA ✅"])
    SUDO(["Confirmar senha + código<br/>modo sudo ✅"])
    AVISO(["Enviar aviso por e-mail 🟡"])
    TMO(["Encerrar sessão por tempo<br/>60 min ocioso · 24 h ✅"])

    EXP["Expiração de sessão"]:::actor
    NOT["AccountNotifier"]:::actor

    USR --- SAIR & SES & ENC1 & ENCT & SENHA & ATV & COD & DES
    SENHA -. «include» .-> SUDO
    SENHA -. «include» .-> ENCT
    ATV -. «include» .-> SUDO
    COD -. «include» .-> SUDO
    DES -. «include» .-> SUDO
    ATV -. «include» .-> AVISO
    DES -. «include» .-> AVISO
    TMO --- EXP
    AVISO --- NOT

    classDef actor fill:#FFF1E8,stroke:#FF6A2B,stroke-width:2px,color:#17120D,font-weight:bold
    classDef planned stroke-dasharray:5 4
```

---

## 3. Perfil, preferências e direitos do titular (RF2 · RF3 · RF23)

```mermaid
flowchart LR
    TIT["Titular"]:::actor
    MEN["Menor de 16"]:::actor

    PERF(["Editar perfil ✅"])
    PREF(["Ajustar preferências<br/>tema · fundo · idioma · fonte ✅"])
    PRIV(["Ajustar privacidade e bem-estar ✅"])
    CONS(["Consentir ou revogar finalidade 🟡"])
    EXP(["Exportar meus dados ⏳"]):::planned
    EXC(["Excluir conta ✅"])
    REAT(["Reativar em até 30 dias ✅"])
    SELO(["Revalidar selo da categoria ✅"])
    TRAV(["Manter proteções do ECA Digital ✅"])
    AUT(["Autorizar mudança de proteção ⏳"]):::planned
    SUDO(["Confirmar senha + código ✅"])
    FIM(["Encerrar todas as sessões ✅"])
    ELIM(["Eliminar e anonimizar conta ✅"])
    APAG(["Apagar posts, comentários e mídias ✅"])
    PED(["Atender pedido do titular ⏳"]):::planned
    INC(["Comunicar incidente ⏳"]):::planned

    RESP["Responsável legal"]:::actor
    JOB["AccountDeletionJob"]:::actor
    ENC["Encarregado (DPO)"]:::actor
    ANPD["ANPD"]:::actor

    TIT --- PERF & PREF & PRIV & CONS & EXP & EXC & REAT
    MEN --- PRIV
    SELO -. «extend» conta com selo .-> PERF
    TRAV -. «extend» menor de 16 .-> PRIV
    AUT -. «extend» pedido do responsável .-> TRAV
    EXC -. «include» .-> SUDO
    EXC -. «include» .-> FIM
    ELIM -. «include» .-> APAG
    AUT --- RESP
    ELIM --- JOB
    PED --- ENC
    INC --- ENC
    INC --- ANPD

    classDef actor fill:#FFF1E8,stroke:#FF6A2B,stroke-width:2px,color:#17120D,font-weight:bold
    classDef planned stroke-dasharray:5 4
```

---

## 4. Feeds, conteúdo e interações (RF24 · RF25 · RF26)

```mermaid
flowchart LR
    VIS["Visitante"]:::actor
    USR["Usuário ativo"]:::actor
    DONO["Dono do post"]:::actor

    FEED(["Navegar nos 4 feeds<br/>e filtrar por 6 eixos ⏳"]):::planned
    ABRIR(["Abrir post no modal ✅"])
    AUTOR(["Ver perfil e feed do autor ✅"])
    COMP(["Compartilhar ✅"])
    CURT(["Curtir ou descurtir ✅"])
    COM(["Comentar ✅"])
    APC(["Apagar comentário ✅"])
    SALV(["Salvar ✅"])
    PUB(["Publicar post de texto ou foto ✅<br/>vídeo ⏳"])
    OUV(["Ouvir áudio ⏳"]):::planned
    SEG(["Seguir perfil ⏳"]):::planned
    ARQ(["Editar, arquivar, restaurar<br/>ou apagar post ✅"])
    LER(["Ler comentários ✅"])
    CANAL(["Escolher canal<br/>link · WhatsApp · Telegram · X · e-mail ✅"])
    MID(["Enviar foto direto ao bucket ✅<br/>URL pré-assinada · 15 min"])
    LIMP(["Limpar a foto ✅<br/>sem EXIF/GPS · até 2.048 px"])
    BKT["Bucket S3<br/>Garage em dev"]:::actor

    VIS --- FEED & ABRIR & AUTOR & COMP
    USR --- CURT & COM & APC & SALV & PUB & OUV & SEG
    DONO --- APC & ARQ
    ABRIR -. «include» .-> LER
    AUTOR -. «extend» toque na foto ou no nome .-> ABRIR
    COMP -. «include» .-> CANAL
    PUB -. «include» .-> MID
    PUB -. «include» .-> LIMP
    MID --- BKT

    classDef actor fill:#FFF1E8,stroke:#FF6A2B,stroke-width:2px,color:#17120D,font-weight:bold
    classDef planned stroke-dasharray:5 4
```

Usuário ativo também faz tudo o que o Visitante faz (generalização). Visitante que toca em Curtir, Comentar
ou Salvar recebe `401` e é levado ao login; conta pendente recebe `403` ("confirme seu e-mail").


### 4.1 Moldura do post — Background Studio (RF28)

```mermaid
flowchart LR
    AUT["Autor"]:::actor
    LEI["Leitor"]:::actor

    ABRIR(["Abrir a moldura ao criar o post ⏳"]):::planned
    COR(["Escolher cor, gradiente<br/>ou cartela sazonal ⏳"]):::planned
    AURA(["Escolher aura, material<br/>e Metamorfose ⏳"]):::planned
    PLUS(["Escolher Aura Plus animada ⏳"]):::planned
    PROPRIA(["Gerar com IA ou enviar arte ⏳"]):::planned
    CONT(["Ajustar container e tinta ⏳"]):::planned
    VER(["Ver o card com a moldura ⏳"]):::planned
    PREV(["Ver prévia ao vivo ⏳"]):::planned
    LIMPA(["Recusar escolhas incompatíveis ✅<br/>servidor · 422"])
    CONTR(["Validar contraste AA ✅<br/>servidor · 422"])
    POSTER(["Ver só o pôster ⏳"]):::planned
    HYPE(["Mostrar Aura Hype ⏳"]):::planned
    MODR(["Moderar e checar flashes ⏳"]):::planned

    MOD["Moderação · EA IRIS"]:::actor
    RANK["Ranking de tendência"]:::actor

    AUT --- ABRIR & COR & AURA & PLUS & PROPRIA & CONT
    LEI --- VER
    ABRIR -. «include» .-> PREV
    AURA -. «include» .-> LIMPA
    PLUS -. «include» .-> LIMPA
    PROPRIA -. «include» .-> LIMPA
    CONT -. «include» .-> CONTR
    PROPRIA -. «include» .-> MODR
    POSTER -. «extend» Reduzir movimento ou economia de dados .-> VER
    HYPE -. «extend» post em alta .-> VER
    MODR --- MOD
    HYPE --- RANK

    classDef actor fill:#FFF1E8,stroke:#FF6A2B,stroke-width:2px,color:#17120D,font-weight:bold
    classDef planned stroke-dasharray:5 4
```

Telas ainda planejadas no app. A API ([RF28](rf/RF28-moldura-post.md) e [RF29](rf/RF29-publicar-post.md)) já valida e guarda a
moldura, e o fluxo inteiro roda no protótipo (telas 22–28) e no teste `design/prototype/studio-smoke.mjs`.

---

## 5. Alertas, vagas e moderação

```mermaid
flowchart LR
    FONTE["Fonte oficial<br/>VERMELHO verificado"]:::actor
    INST["Instituição ou Networking<br/>VERMELHO · AMARELO"]:::actor
    USR["Usuário ativo"]:::actor

    ALE(["Publicar alerta oficial ⏳"]):::planned
    VAGA(["Publicar vaga ⏳"]):::planned
    REC(["Receber alerta da região ⏳"]):::planned
    DEN(["Denunciar post ou comentário ⏳"]):::planned
    VERIF(["Exigir selo VERIFIED ✅"])
    REM(["Remover post ou comentário ⏳"]):::planned
    SELO(["Conferir selo<br/>CNPJ · domínio · representante ⏳"]):::planned
    SUS(["Suspender ou reativar conta ⏳"]):::planned
    SSO(["Entrar com a conta Velion ⏳"]):::planned
    PTS(["Ganhar pontos e troféus ⏳"]):::planned

    MOD["Moderação"]:::actor
    VEL["Módulos Velion"]:::actor

    FONTE --- ALE
    INST --- VAGA
    USR --- REC & DEN & SSO & PTS
    ALE -. «include» .-> VERIF
    REM -. «extend» denúncia procedente .-> DEN
    REM & SELO & SUS --- MOD
    SSO & PTS --- VEL

    classDef actor fill:#FFF1E8,stroke:#FF6A2B,stroke-width:2px,color:#17120D,font-weight:bold
    classDef planned stroke-dasharray:5 4
```

A regra "só VERMELHO verificado publica alerta" já está no domínio (`UserCategoryEnum.canPublishOfficialAlerts`);
o fluxo de publicação ainda não.

---

## 6. Especificação resumida

| Caso de uso | Atores | RF | Endpoint / componente | Situação |
|---|---|---|---|---|
| Criar conta (tipo, campos, Termos) | Visitante, Menor de 16 | [RF1](rf/RF01-cadastro-usuario.md) | `POST /api/v1/auth/register` | ✅ |
| Confirmar e-mail | Usuário pendente | RF1 | `POST /api/v1/me/verify-email` (+ `/resend`) | ✅ |
| Entrar · 2FA · reativar | Visitante | [RF27](rf/RF27-autenticacao-sessao.md) | `POST /api/v1/auth/login`, `/login/2fa`, `/reactivate` | ✅ |
| Limitar tentativas | LoginThrottle | RF27 | `LoginThrottle` (Valkey) | ✅ |
| Sair | Usuário | RF27 | `POST /api/v1/auth/logout` + `BroadcastChannel` | ✅ |
| Ver e encerrar sessões | Usuário | RF27 | `GET/DELETE /api/v1/me/sessions[/{id}]` | ✅ |
| Ativar, regenerar e desativar 2FA | Usuário | RF27 | `/api/v1/me/mfa/*` | ✅ |
| Trocar senha | Usuário | RF27 | `POST /api/v1/me/password` | ✅ |
| Encerrar sessão por tempo | Expiração de sessão | RF27 | Spring Session TTL + `AbsoluteSessionTimeoutFilter` | ✅ |
| Editar perfil | Titular | [RF2](rf/RF02-editar-perfil.md) | `PATCH /api/v1/me/profile` | ✅ |
| Ajustar preferências e privacidade | Titular, Menor de 16 | RF2 | `PATCH /api/v1/me/preferences` | ✅ |
| Consentir ou revogar | Titular | [RF3](rf/RF03-consentimento-privacidade.md) | `consent_event` | 🟡 registro no cadastro; tela de troca ⏳ |
| Excluir conta · reativar | Titular | [RF23](rf/RF23-direitos-titular-lgpd.md) | `POST /api/v1/me/deletion`, `POST /api/v1/auth/reactivate` | ✅ |
| Eliminar e anonimizar | AccountDeletionJob | RF23 | `AccountService.eliminate` + `PostContentEraser` | ✅ |
| Exportar dados | Titular | RF23 | — | ⏳ OS-43 |
| Abrir post no modal | Visitante, Usuário | [RF24](rf/RF24-visualizar-post.md) | `GET /api/v1/posts/{id}` | ✅ |
| Ver perfil e feed do autor | Visitante, Usuário | [RF25](rf/RF25-perfil-publico-autor.md) | `GET /api/v1/users/{id}/profile`, `/posts` | ✅ |
| Curtir, comentar, apagar, compartilhar, salvar | Usuário ativo, Dono do post | [RF26](rf/RF26-interacoes-post.md) | `PUT/DELETE …/like` e `…/save`, `GET/POST …/comments`, `DELETE …/comments/{id}`, `POST …/shares` | ✅ |
| Publicar, editar, arquivar, restaurar e apagar post | Usuário ativo (instituição e banco com selo) | [RF29](rf/RF29-publicar-post.md) | `POST /api/v1/media/uploads`, `POST /api/v1/posts`, `PATCH`/`DELETE /api/v1/posts/{id}`, `…/archive`, `…/restore` | ✅ texto e foto · ⏳ vídeo e áudio |
| Moldura do post (Background Studio, Aura Plus) | Autor, Leitor, Moderação | [RF28](rf/RF28-moldura-post.md) | `GET /api/v1/backgrounds/catalog`, `/recommendations`, `background` no post | ✅ API e validação · protótipo ✅ · ⏳ arte própria e app |
| Navegar nos feeds com filtros | Visitante, Usuário | — | `FeedController` | ⏳ |
| Publicar alerta · vaga | Fonte oficial · Instituição | — | Alert Feed | ⏳ |
| Moderação (selo, remoção, suspensão) | Moderação | — | papel e painel de moderação | ⏳ |
| SSO e pontos Velion | Módulos Velion | — | Keycloak (OS-13), `VelionPointsService` | ⏳ |

Os diagramas de **sequência**, **estados** e **atividades** de cada caso implementado estão no documento do RF;
os transversais em [DIAGRAMA_SEQUENCIA.md](DIAGRAMA_SEQUENCIA.md), [MAQUINA_ESTADOS.md](MAQUINA_ESTADOS.md) e
[DIAGRAMA_ATIVIDADES.md](DIAGRAMA_ATIVIDADES.md).
