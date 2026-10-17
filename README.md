# Orange Social

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

- [Diagrama de classes](docs/DIAGRAMA_CLASSES.md) · [Máquinas de estados](docs/MAQUINA_ESTADOS.md) ·
  [Componentes](docs/DIAGRAMA_COMPONENTES.md) · [Sequência: Audio Feed](docs/DIAGRAMA_SEQUENCIA.md) ·
  [Atividades: cadastro](docs/DIAGRAMA_ATIVIDADES.md)
- [Pesquisa de tecnologias (ADRs)](docs/PESQUISA_TECNOLOGIAS.md) · [Design system](docs/DESIGN_SYSTEM.md)
- [Backlog para o Trello](docs/TRELLO_BACKLOG.md)

## Build

```bash
mvn test
python3 scripts/wcag_contrast.py
```
