# Orange Social

<p align="center"><img src="design/brand/orange-social-logo.svg" width="160" alt="Orange Social"></p>

[![CI](https://github.com/matheushaliski/orange_social_velion/actions/workflows/ci.yml/badge.svg)](https://github.com/matheushaliski/orange_social_velion/actions/workflows/ci.yml)
[![CodeQL](https://github.com/matheushaliski/orange_social_velion/actions/workflows/codeql.yml/badge.svg)](https://github.com/matheushaliski/orange_social_velion/actions/workflows/codeql.yml)

Rede social do ecossistema **Velion** com categorização visual de usuários (6 cores), quatro feeds
independentes (Profile · Post · Audio · Alert), filtro multidimensional de 6 eixos e conformidade
LGPD por construção.

## Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Java 21+ (alvo 25 LTS) · Spring Boot 4.1 · virtual threads |
| Fonte da verdade | PostgreSQL 17 + PostGIS (`VSusercontrolist`, consentimentos, outbox) |
| Cache / ranking / sessões | Valkey 9 (ZSET para o Trending Score) |
| Timeline / logs / notificações | Apache Cassandra 5 |
| Mídias | API S3 (AWS S3 sa-east-1 em produção, Garage em desenvolvimento) |

## Estrutura

```
design/brand/              logo principal (SVG) e mark
docs/                      diagramas Mermaid, pesquisa de tecnologias, design system, backlog Trello
scripts/wcag_contrast.py   verificação de contraste da paleta
src/main/resources/
  schema.sql               DDL PostgreSQL (VSusercontrolist · consent_event · user_key · outbox_event)
  cassandra/schema.cql     keyspace e tabelas Cassandra
src/main/java/com/orangesocial/
  domain/model/            UserControlList, UserCategoryEnum, AccountStatus, GeoLocation, ...
  infrastructure/          persistence/postgres · persistence/cassandra · cache/redis (Valkey)
```

## Documentação

- **[Requisitos funcionais — diagramas por RF](docs/rf/README.md)** (mantidos junto com o código; verificados no CI)
- [Diagrama de classes](docs/DIAGRAMA_CLASSES.md) · [Máquinas de estados](docs/MAQUINA_ESTADOS.md) ·
  [Componentes](docs/DIAGRAMA_COMPONENTES.md) · [Sequência: Audio Feed](docs/DIAGRAMA_SEQUENCIA.md) ·
  [Atividades: cadastro](docs/DIAGRAMA_ATIVIDADES.md)
- [Pesquisa de tecnologias (ADRs)](docs/PESQUISA_TECNOLOGIAS.md) · [Design system](docs/DESIGN_SYSTEM.md)
- [Backlog para o Trello](docs/TRELLO_BACKLOG.md)
- [Protótipo de interface](design/prototype/index.html) · [telas renderizadas](design/prototype/screens/) ·
  [marca e logo](design/brand/) ([regras](docs/DESIGN_SYSTEM.md#8-marca))

## API (até agora)

| Método e rota | RF | O que faz |
|---|---|---|
| `GET /api/v1/posts/{id}` | RF24 | Post completo para o modal: autor, `publishedAt`, contagens, estado dos botões, `shareUrl` |
| `GET /api/v1/users/{id}/profile` · `GET /api/v1/users/{id}/posts?cursor=` | RF25 | Perfil público (dados mínimos) e feed do autor paginado por cursor |
| `PUT`/`DELETE /api/v1/posts/{id}/like` · `…/save` | RF26 | Curtir e salvar, idempotentes |
| `GET`/`POST /api/v1/posts/{id}/comments` · `DELETE …/comments/{cid}` | RF26 | Caixa de mensagens do post |
| `POST /api/v1/posts/{id}/shares` `{channel}` | RF26 | Registra o compartilhamento e devolve link e total |

Erros em Problem Details (RFC 9457) com mensagem em pt-BR. Ainda não há login (Keycloak no OS-13): em
desenvolvimento, `ORANGE_DEV_HEADER_AUTH=true` aceita o usuário no cabeçalho `X-Orange-Dev-User` —
nunca em produção.

## Ambiente local

```bash
docker compose up -d                  # PostgreSQL+PostGIS :5432 · Valkey :6379 · Garage (S3) :3900
docker compose --profile full up -d   # + Cassandra 5 :9042 (aplica cassandra/schema.cql)
mvn spring-boot:run                   # Flyway aplica db/migration/V1__baseline.sql
```

Credenciais de desenvolvimento: PostgreSQL `orange`/`orange`; Garage access key `GK0000000000000000orangedev`
(secret em `infra/garage/init.sh`), bucket `orange-social-media`.

## Build e testes

```bash
mvn test                        # unitários (sem Docker)
mvn verify                      # + testes de integração *IT com Testcontainers (PostGIS, Valkey, Cassandra 5)
python3 scripts/wcag_contrast.py
```

`mvn package` também gera o SBOM CycloneDX em `target/classes/META-INF/sbom/application.cdx.json` (exposto em `/actuator/sbom` quando o Actuator estiver habilitado); `mvn package jib:dockerBuild` constrói a imagem
OCI `orange-social:local` no daemon Docker sem Dockerfile.

Para reproduzir o scan de imagem do CI localmente:
`docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image --severity HIGH,CRITICAL --ignore-unfixed orange-social:local`.

Os testes de integração usam `@ServiceConnection` (`src/test/java/com/orangesocial/support/PolyglotContainers.java`)
e o perfil `it`. Com `testcontainers.reuse.enable=true` em `~/.testcontainers.properties` os containers
são reaproveitados entre execuções.
