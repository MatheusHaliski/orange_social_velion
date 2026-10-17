# CLAUDE.md — Orange Social

Rede social do ecossistema Velion. Backend Spring Boot 4.1 / Java 21+ (alvo 25) com PostgreSQL + PostGIS,
Valkey, Cassandra e API S3. Documentação e mensagens ao usuário em **português (pt-BR)**.

## Regra obrigatória: diagramas por RF sempre atualizados

Todo requisito funcional (RF) tem um documento em `docs/rf/` com diagramas Mermaid e rastreabilidade.
Ao trabalhar em qualquer RF:

- **RF novo** → criar `docs/rf/RFnn-slug.md` (cabeçalho `rf`, `titulo`, `status`, `cards`, `paths`) e
  adicionar a linha no catálogo `docs/rf/README.md`.
- **Mudança de comportamento** em arquivo listado em `paths` de um RF → atualizar no **mesmo commit/PR**
  os diagramas (caso de uso, sequência, estados, atividades) e a tabela de rastreabilidade daquele RF.
- **Arquivo novo que implementa um RF** → incluí-lo em `paths` do RF correspondente.
- Diagramas transversais (`docs/DIAGRAMA_*.md`, `docs/MAQUINA_ESTADOS.md`) também devem refletir o código.
- `[rf-docs-skip: RFn, …] motivo` (ou `[rf-docs-skip]` para todos), **no início de uma linha** da mensagem de
  commit, só para mudanças sem efeito no comportamento daqueles RFs.

Antes de commitar, rode `python3 scripts/check_rf_docs.py --base origin/main`. O job **Docs por RF** do CI
repete essa verificação e renderiza todo Mermaid de `docs/`; diagrama inválido ou desatualizado falha o build.

## Comandos

```bash
mvn test                                   # unitários
mvn verify                                 # + integração com Testcontainers (exige Docker)
python3 scripts/check_rf_docs.py           # estrutura dos docs de RF
python3 scripts/wcag_contrast.py           # contraste da paleta
docker compose up -d                       # PostGIS, Valkey, Garage (+ --profile full para Cassandra)
```

## Convenções

- `schema.sql` é a DDL de referência e deve ser a concatenação exata de `db/migration/V1..Vn` (`SchemaConsistencyTest`).
  Mudança de schema = nova migração `V{n}__*.sql` (começando com uma linha em branco) + o mesmo texto anexado a `schema.sql`.
- Identidade na API: sessão opaca no Valkey (Spring Session) criada por `/api/v1/auth/*` (RF27); escrita exige
  `X-XSRF-TOKEN`. Nunca JWT/token em localStorage. Testes de integração entram com login real (`support/ApiClient`).
- Segredos: `ORANGE_APP_SECRET` (Base64, 32+ bytes) é obrigatório fora dos perfis `dev`/`it`; nada de segredo em yml.
- Termos de Uso da Velion em `docs/legal/TERMOS_DE_USO.md` (marcadores `{{…}}`); mudar o texto = nova
  `orange-social.legal.terms-version`.
- Cores, glifos e contraste seguem `docs/DESIGN_SYSTEM.md`; a cor nunca é o único sinal.
- Decisões de tecnologia ficam em `docs/PESQUISA_TECNOLOGIAS.md` (ADRs); backlog em `docs/TRELLO_BACKLOG.md`
  e no quadro Trello "Orange Social - Velion Tech".
