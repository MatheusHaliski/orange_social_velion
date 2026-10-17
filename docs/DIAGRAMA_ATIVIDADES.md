# Diagrama de Atividades — Cadastro por Tipo de Usuário

Cobre o RF1/RF2 (cadastro e perfil), a cadeia de seleção de comunidades de interesse
(`typeofcommunity → selectcountry → selectcity`) e a captura opcional de GPS
(`LastSavedLocation`) sob consentimento (LGPD Art. 7º, I).

```mermaid
flowchart TD
    START((Início)) --> A1[Informar Name, Email, Password,<br/>Recoveryemail, Cellphonenumber]
    A1 --> D1{E-mail já<br/>cadastrado?}
    D1 -- Sim --> E1[Exibir erro e sugerir<br/>recuperar senha] --> A1
    D1 -- Não --> A2[Selecionar Usertype]

    A2 --> D2{Categoria escolhida}
    D2 -- "VERDE · Pessoa Física" --> P1[Userdb, Gender<br/>sexualpreference opcional]
    D2 -- "AMARELO · Imprensa/Networking" --> P2[Nome do veículo, área editorial]
    D2 -- "AZUL · Marketing" --> P3[Razão social, segmento]
    D2 -- "LARANJA · Comunidade" --> P4[Tipo de comunidade,<br/>responsável legal]
    D2 -- "VERMELHO · Instituição" --> P5[CNPJ / órgão,<br/>documento comprobatório]
    D2 -- "PRETO · Especial" --> P6[Tipo de evento/conta especial,<br/>aprovação manual]

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

    A7[Revisar termos e política de privacidade<br/>sem caixas pré-marcadas]
    A7 --> A8[(INSERT VSusercontrolist<br/>status = PENDING_VERIFICATION)]
    A8 --> A9[Enviar código por e-mail/SMS]
    A9 --> D7{Código válido<br/>em até 7 dias?}
    D7 -- Sim --> A10[status = ACTIVE<br/>criar carteira Velion Points] --> FIM((Fim))
    D7 -- Não --> A11[Eliminar cadastro incompleto<br/>status = ANONYMOUS_LGPD_DELETED] --> FIM
```

## Regras aplicadas no fluxo

| Regra | Origem |
|---|---|
| Nenhum toggle de consentimento vem ligado; reconhecimento facial e localização começam desligados | Privacy by Default (Art. 46 §2º) |
| `sexualpreference` só é gravado com consentimento específico e destacado | Art. 11, I |
| Listas de país e cidade são filtradas pelo item anterior (`typeofcommunity → selectcountry → selectcity`) | Requisito de UX |
| Contas `VERMELHO` e `PRETO` entram com verificação manual antes de ganhar selo | Alert Feed só aceita fontes verificadas |
| Cadastro não confirmado em 7 dias é eliminado | Princípio da necessidade (Art. 6º, III) |
