# Diagrama de Atividades — Cadastro por Tipo de Usuário

Cobre o RF1/RF2 (cadastro e perfil; campos por tipo em `PESQUISA_DADOS_USUARIO.md` §3 e regras em
`RegistrationService`/`UserTypeDetailsValidator`), a cadeia de seleção de comunidades de interesse
(`typeofcommunity → selectcountry → selectcity`) e a captura opcional de GPS
(`LastSavedLocation`) sob consentimento (LGPD Art. 7º, I).

```mermaid
flowchart TD
    START((Início)) --> A1[Informar nome de exibição, @usuário,<br/>e-mail, senha 12+, data de nascimento]
    A1 --> D1{E-mail ou @<br/>já em uso?}
    D1 -- Sim --> E1[409: sugerir entrar<br/>ou recuperar senha] --> A1
    D1 -- Não --> DI{Idade}
    DI -- "< 13" --> E2[Recusar: Orange é 13+] --> FIM
    DI -- "13 a 15" --> GU[E-mail do responsável<br/>ECA Digital · só VERDE<br/>proteções travadas] --> A2
    DI -- "16+" --> A2[Selecionar Usertype<br/>6 cores · glifo · rótulo]

    A2 --> D2{Categoria escolhida}
    D2 -- "VERDE · Pessoa Física" --> P1[cidade, site, ocupação<br/>tudo opcional · sexualpreference opcional]
    D2 -- "AMARELO · Imprensa/Networking" --> P2[subtipo, veículo, site, função<br/>MTb e CNPJ opcionais]
    D2 -- "AZUL · Marketing" --> P3[CNPJ, razão social, site,<br/>segmento, responsável]
    D2 -- "LARANJA · Comunidade" --> P4[tipo de comunidade, cidade/UF,<br/>responsável · CNPJ opcional]
    D2 -- "VERMELHO · Instituição" --> P5[subtipo, CNPJ, razão social, site,<br/>setor, representante legal]
    D2 -- "PRETO · Especial" --> P6[subtipo e organizador<br/>evento: nome, data, local · banco: CNPJ + BCB]

    P1 --> D3{sexualpreference<br/>preenchido?}
    D3 -- Sim --> C0[Exigir consentimento específico<br/>SENSITIVE_PROFILE_DATA · Art. 11, I] --> A3
    D3 -- Não --> A3
    P2 & P3 & P4 --> A3
    P5 & P6 --> V1[Enfileirar verificação manual<br/>selo pendente] --> A3

    A3[Residência: Cityzenship, Country,<br/>State, City, Address]
    A3 --> A4[Selecionar Listofinterestandhobbies<br/>e Listofjobsinterests]

    A4 --> C1

    subgraph Comunidades["Comunidades de interesse (encadeado)"]
        C1[typeofcommunity<br/>igreja, clube, grupo...] --> C2[selectcountry<br/>lista filtrada pelo tipo]
        C2 --> C3[selectcity<br/>lista filtrada pelo país]
        C3 --> C4[Adicionar a<br/>Listofcommunitiesofinterest]
        C4 --> D4{Adicionar outra<br/>comunidade?}
        D4 -- Sim --> C1
    end

    D4 -- Não --> A5[Upload de Photo<br/>URL pré-assinada S3]

    A5 --> D5{Usuário ativa<br/>LOCATION_TRACKING?<br/>padrão: desligado}
    D5 -- Não --> A7
    D5 -- Sim --> G1[Registrar consentimento<br/>Art. 7º, I]
    G1 --> G2[Solicitar permissão de<br/>geolocalização ao SO]
    G2 --> D6{Permissão<br/>concedida?}
    D6 -- Não --> G4[Manter consentimento,<br/>sem coordenadas] --> A7
    D6 -- Sim --> G3[Capturar lat, lng, timestamp<br/>→ LastSavedLocation]
    G3 --> A7

    A7[Ler e aceitar os Termos de Uso da Velion<br/>caixa desmarcada · versão registrada]
    A7 --> A8[(INSERT VSusercontrolist PENDING_VERIFICATION<br/>+ terms_acceptance + 6 consent_event false<br/>+ user_preference · sessão aberta)]
    A8 --> A9[Enviar código de 6 dígitos por e-mail<br/>30 min · 5 tentativas · reenvio 1/min]
    A9 --> D7{Código confirmado<br/>em até 7 dias?}
    D7 -- Sim --> A10[status = ACTIVE<br/>criar carteira Velion Points ⏳] --> FIM((Fim))
    D7 -- Não --> A11[Eliminar cadastro incompleto ⏳<br/>status = ANONYMOUS_LGPD_DELETED] --> FIM
```

## Regras aplicadas no fluxo

| Regra | Origem |
|---|---|
| Nenhum toggle de consentimento vem ligado; reconhecimento facial e localização começam desligados | Privacy by Default (Art. 46 §2º) |
| `sexualpreference` só é gravado com consentimento específico e destacado | Art. 11, I |
| Listas de país e cidade são filtradas pelo item anterior (`typeofcommunity → selectcountry → selectcity`) | Requisito de UX |
| Contas `VERMELHO` e `PRETO` entram com verificação manual antes de ganhar selo | Alert Feed só aceita fontes verificadas |
| Cadastro não confirmado em 7 dias é eliminado (⏳ job de limpeza) | Princípio da necessidade (Art. 6º, III) |

Passos marcados com ⏳ ainda não estão no código; foto por URL pré-assinada (OS-18), comunidades encadeadas
(OS-15) e GPS dependem de telas e endpoints que virão.

## Outros diagramas de atividades

| Fluxo | Onde |
|---|---|
| Regras por tipo de usuário no cadastro | [RF1](rf/RF01-cadastro-usuario.md#atividades--regras-por-tipo-de-usuário) |
| O que muda com cada campo do perfil | [RF2](rf/RF02-editar-perfil.md#atividades--o-que-muda-junto-com-cada-campo-do-perfil) |
| Paginação por cursor do feed do autor | [RF25](rf/RF25-perfil-publico-autor.md#paginação-por-cursor) |
| Regras de visibilidade do post | [RF24](rf/RF24-visualizar-post.md#regras-de-visibilidade) |
