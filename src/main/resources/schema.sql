-- =============================================================================
-- Orange Social · PostgreSQL 17 + PostGIS (fonte da verdade / ACID)
-- Tabela VSusercontrolist: cadastro, autenticação e perfil do usuário.
--
-- Mapeamento dos 19 campos de negócio -> coluna física:
--   Name                         -> name
--   Password                     -> password_hash            (Argon2id, nunca texto puro)
--   Email                        -> email
--   Recoveryemail                -> recovery_email
--   Cityzenship                  -> citizenship
--   Country of residence         -> country_of_residence     (ISO 3166-1 alpha-2)
--   State of residence           -> state_of_residence
--   City of residence            -> city_of_residence
--   Address                      -> address
--   Cellphonenumber              -> cellphone_number         (E.164)
--   Listofinterestandhobbies     -> list_of_interests_and_hobbies   (JSONB array)
--   Listofjobsinterests          -> list_of_jobs_interests          (JSONB array)
--   Userdb                       -> user_date_of_birth       (data de nascimento)
--   Gender                       -> gender
--   sexualpreference             -> sexual_preference        (DADO SENSÍVEL · LGPD Art. 11)
--   Photo                        -> photo_object_key         (chave do objeto no S3)
--   Usertype                     -> user_type                (VERDE..PRETO)
--   Listofcommunitiesofinterest  -> list_of_communities_of_interest (JSONB array)
--   LastSavedLocation            -> last_saved_location      (JSONB {lat, lng, timestamp})
--                                   + last_saved_point       (GEOGRAPHY gerada, para consultas PostGIS)
--
-- Colunas técnicas adicionais: id, account_status, created_at, updated_at,
-- deleted_at, version (lock otimista).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- busca aproximada por nome (eixo "Nome")
CREATE EXTENSION IF NOT EXISTS unaccent;   -- ignora acentos em pt-BR

-- unaccent() não é IMMUTABLE (depende do dicionário), logo não pode entrar em índice.
-- Wrapper imutável fixando o dicionário padrão: usar f_unaccent() nas consultas do eixo "Nome"
-- para que o planejador aproveite o índice trigram.
CREATE OR REPLACE FUNCTION f_unaccent(text)
    RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
    RETURN public.unaccent('public.unaccent', $1);

CREATE TABLE IF NOT EXISTS "VSusercontrolist" (
    id                              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- 1..4 · identificação e credenciais
    name                            VARCHAR(120)  NOT NULL,
    password_hash                   VARCHAR(255)  NOT NULL,
    email                           VARCHAR(254)  NOT NULL,
    recovery_email                  VARCHAR(254),

    -- 5..9 · cidadania e residência
    citizenship                     VARCHAR(2),
    country_of_residence            VARCHAR(2),
    state_of_residence              VARCHAR(80),
    city_of_residence               VARCHAR(120),
    address                         VARCHAR(255),

    -- 10 · contato
    cellphone_number                VARCHAR(20),

    -- 11..12 · interesses (JSONB array de códigos da taxonomia)
    list_of_interests_and_hobbies   JSONB,
    list_of_jobs_interests          JSONB,

    -- 13..15 · dados demográficos
    user_date_of_birth              DATE,
    gender                          VARCHAR(40),
    sexual_preference               VARCHAR(40),

    -- 16 · mídia (objeto no S3)
    photo_object_key                VARCHAR(512),

    -- 17 · categoria visual do usuário
    user_type                       VARCHAR(10)   NOT NULL DEFAULT 'VERDE',

    -- 18 · comunidades (typeofcommunity -> selectcountry -> selectcity)
    list_of_communities_of_interest JSONB,

    -- 19 · última localização GPS conhecida
    last_saved_location             JSONB,
    last_saved_point                GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
                                        CASE
                                            WHEN last_saved_location ? 'lat' AND last_saved_location ? 'lng'
                                            THEN ST_SetSRID(ST_MakePoint(
                                                     (last_saved_location->>'lng')::double precision,
                                                     (last_saved_location->>'lat')::double precision), 4326)::geography
                                        END) STORED,

    -- técnicas / ciclo de vida
    account_status                  VARCHAR(30)   NOT NULL DEFAULT 'PENDING_VERIFICATION',
    created_at                      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at                      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    deleted_at                      TIMESTAMPTZ,
    version                         BIGINT        NOT NULL DEFAULT 0,

    CONSTRAINT uk_vsusercontrolist_email UNIQUE (email),
    CONSTRAINT chk_vsusercontrolist_user_type
        CHECK (user_type IN ('VERDE','AMARELO','AZUL','LARANJA','VERMELHO','PRETO')),
    CONSTRAINT chk_vsusercontrolist_status
        CHECK (account_status IN ('PENDING_VERIFICATION','ACTIVE','SUSPENDED','ANONYMOUS_LGPD_DELETED')),
    CONSTRAINT chk_vsusercontrolist_interests_json
        CHECK (list_of_interests_and_hobbies IS NULL OR jsonb_typeof(list_of_interests_and_hobbies) = 'array'),
    CONSTRAINT chk_vsusercontrolist_jobs_json
        CHECK (list_of_jobs_interests IS NULL OR jsonb_typeof(list_of_jobs_interests) = 'array'),
    CONSTRAINT chk_vsusercontrolist_communities_json
        CHECK (list_of_communities_of_interest IS NULL OR jsonb_typeof(list_of_communities_of_interest) = 'array'),
    CONSTRAINT chk_vsusercontrolist_location_json
        CHECK (last_saved_location IS NULL OR jsonb_typeof(last_saved_location) = 'object')
);

COMMENT ON TABLE  "VSusercontrolist" IS 'Orange Social · cadastro de usuários';
COMMENT ON COLUMN "VSusercontrolist".citizenship          IS 'ISO 3166-1 alpha-2';
COMMENT ON COLUMN "VSusercontrolist".country_of_residence IS 'ISO 3166-1 alpha-2';
COMMENT ON COLUMN "VSusercontrolist".cellphone_number     IS 'Formato E.164';
COMMENT ON COLUMN "VSusercontrolist".sexual_preference    IS 'Dado sensível (LGPD Art. 5º II / Art. 11): opt-in explícito; cifrado na aplicação';
COMMENT ON COLUMN "VSusercontrolist".photo_object_key     IS 'ex.: users/{id}/avatar/{uuid}.webp';
COMMENT ON COLUMN "VSusercontrolist".list_of_communities_of_interest
    IS 'ex.: [{"typeOfCommunity":"CHURCH","country":"BR","city":"Curitiba"}]';
COMMENT ON COLUMN "VSusercontrolist".last_saved_location
    IS '{"lat":-25.42,"lng":-49.27,"timestamp":"2026-10-17T12:00:00Z"}';
COMMENT ON COLUMN "VSusercontrolist".deleted_at IS 'Preenchido na eliminação (LGPD Art. 18, VI)';

-- Filtros dos feeds (6 eixos)
CREATE INDEX IF NOT EXISTS idx_vsusercontrolist_user_type
    ON "VSusercontrolist" (user_type);
CREATE INDEX IF NOT EXISTS idx_vsusercontrolist_location
    ON "VSusercontrolist" (country_of_residence, state_of_residence, city_of_residence);
CREATE INDEX IF NOT EXISTS idx_vsusercontrolist_status
    ON "VSusercontrolist" (account_status);
CREATE INDEX IF NOT EXISTS idx_vsusercontrolist_name_trgm
    ON "VSusercontrolist" USING GIN (lower(f_unaccent(name)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_vsusercontrolist_point
    ON "VSusercontrolist" USING GIST (last_saved_point);
CREATE INDEX IF NOT EXISTS idx_vsusercontrolist_interests
    ON "VSusercontrolist" USING GIN (list_of_interests_and_hobbies);
CREATE INDEX IF NOT EXISTS idx_vsusercontrolist_communities
    ON "VSusercontrolist" USING GIN (list_of_communities_of_interest);

-- =============================================================================
-- Consentimentos LGPD (Art. 7º, I · Art. 8º §5º · Art. 11) — append-only.
-- Cada mudança de toggle gera uma linha; o estado atual é a linha mais recente
-- por (user_id, purpose). O histórico é preservado para prestação de contas
-- (princípio da responsabilização, Art. 6º, X).
-- =============================================================================

CREATE TABLE IF NOT EXISTS consent_event (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         BIGINT       NOT NULL REFERENCES "VSusercontrolist" (id) ON DELETE CASCADE,
    purpose         VARCHAR(40)  NOT NULL,
    legal_basis     VARCHAR(40)  NOT NULL,       -- ex.: ART_7_I, ART_11_I
    granted         BOOLEAN      NOT NULL DEFAULT FALSE,   -- Privacy by Default
    policy_version  VARCHAR(20)  NOT NULL,
    channel         VARCHAR(20)  NOT NULL,       -- WEB, IOS, ANDROID, SUPPORT
    ip_hash         CHAR(64),                    -- SHA-256, nunca o IP em claro
    occurred_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_consent_purpose CHECK (purpose IN (
        'MARKETING','LOCATION_TRACKING','PERSONALIZED_FEED',
        'FACIAL_RECOGNITION','SENSITIVE_PROFILE_DATA','THIRD_PARTY_SHARING'))
);

CREATE INDEX IF NOT EXISTS idx_consent_event_user_purpose
    ON consent_event (user_id, purpose, occurred_at DESC);

-- Estado atual de cada consentimento (última linha por finalidade)
CREATE OR REPLACE VIEW user_consent_current AS
SELECT DISTINCT ON (user_id, purpose)
       user_id, purpose, legal_basis, granted, policy_version, occurred_at
FROM consent_event
ORDER BY user_id, purpose, occurred_at DESC;

-- =============================================================================
-- Chave de dados por usuário (envelope encryption · crypto-shredding).
-- A DEK é cifrada pela KMS; destruí-la na exclusão torna ilegíveis os dados
-- sensíveis em backups, Cassandra e S3 (LGPD Art. 18, VI / Art. 16).
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_key (
    user_id         BIGINT       PRIMARY KEY REFERENCES "VSusercontrolist" (id) ON DELETE CASCADE,
    wrapped_dek     BYTEA        NOT NULL,
    kms_key_id      VARCHAR(255) NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    destroyed_at    TIMESTAMPTZ
);

-- =============================================================================
-- Outbox transacional: eventos gravados na mesma transação do domínio e
-- publicados (Debezium / Modulith) para Cassandra, Valkey e OpenSearch.
-- =============================================================================

CREATE TABLE IF NOT EXISTS outbox_event (
    id              UUID         PRIMARY KEY,
    aggregate_type  VARCHAR(40)  NOT NULL,       -- user, post, alert, engagement, media
    aggregate_id    VARCHAR(64)  NOT NULL,
    event_type      VARCHAR(60)  NOT NULL,
    payload         JSONB        NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- =============================================================================
-- V2 · Posts e interações
--   RF24 visualizar post em detalhe · RF25 perfil público com feed do autor ·
--   RF26 curtir, comentar, compartilhar e salvar (docs/rf/)
--
-- `post` é o registro canônico; a timeline do Cassandra é só projeção. Os contadores
-- (like_count, comment_count, share_count) são mantidos pela aplicação na MESMA transação
-- da interação (PostInteractionService), nunca recalculados por COUNT(*) na leitura.
-- =============================================================================

CREATE TABLE IF NOT EXISTS post (
    id                UUID          PRIMARY KEY,         -- UUIDv7 gerado na aplicação = post_id da timeline
    author_user_id    BIGINT        NOT NULL REFERENCES "VSusercontrolist" (id),
    author_user_type  VARCHAR(10)   NOT NULL,            -- categoria copiada na publicação (filtro sem join)
    feed_type         VARCHAR(10)   NOT NULL,
    media_type        VARCHAR(10)   NOT NULL DEFAULT 'TEXT',
    title             VARCHAR(140)  NOT NULL,
    subtitle          VARCHAR(280),
    body              TEXT,
    media_object_key  VARCHAR(512),                      -- chave no S3
    duration_seconds  INTEGER,                           -- apenas Audio Feed
    age_rating        VARCHAR(10)   NOT NULL DEFAULT 'LIVRE',
    status            VARCHAR(12)   NOT NULL DEFAULT 'DRAFT',
    country           VARCHAR(2),
    city              VARCHAR(120),
    like_count        BIGINT        NOT NULL DEFAULT 0,
    comment_count     BIGINT        NOT NULL DEFAULT 0,
    share_count       BIGINT        NOT NULL DEFAULT 0,
    view_count        BIGINT        NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    removed_at        TIMESTAMPTZ,
    version           BIGINT        NOT NULL DEFAULT 0,

    CONSTRAINT chk_post_author_user_type
        CHECK (author_user_type IN ('VERDE','AMARELO','AZUL','LARANJA','VERMELHO','PRETO')),
    CONSTRAINT chk_post_feed_type   CHECK (feed_type IN ('PROFILE','POST','AUDIO','ALERT')),
    CONSTRAINT chk_post_media_type  CHECK (media_type IN ('TEXT','IMAGE','VIDEO','AUDIO')),
    CONSTRAINT chk_post_age_rating  CHECK (age_rating IN ('LIVRE','AGE_12','AGE_16','AGE_18','SENSITIVE')),
    CONSTRAINT chk_post_status      CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED','REMOVED')),
    CONSTRAINT chk_post_counters
        CHECK (like_count >= 0 AND comment_count >= 0 AND share_count >= 0 AND view_count >= 0)
);

COMMENT ON TABLE  post IS 'Orange Social · registro canônico do post (a timeline Cassandra é projeção)';
COMMENT ON COLUMN post.created_at IS 'Data de publicação exibida no card (relativa) e no detalhe (absoluta)';
COMMENT ON COLUMN post.removed_at IS 'Moderação ou eliminação do autor (LGPD Art. 18, VI): conteúdo apagado';

-- Feed do autor (RF25): mais recentes primeiro, paginação por cursor (created_at, id)
CREATE INDEX IF NOT EXISTS idx_post_author_created
    ON post (author_user_id, created_at DESC, id DESC)
    WHERE status IN ('PUBLISHED','ARCHIVED');

-- =============================================================================
-- Reações: LIKE (público, contado) e SAVE (privado, nunca exibido a terceiros).
-- A PK impede curtir duas vezes; curtir/descurtir é idempotente.
-- =============================================================================

CREATE TABLE IF NOT EXISTS post_reaction (
    post_id     UUID         NOT NULL REFERENCES post (id) ON DELETE CASCADE,
    user_id     BIGINT       NOT NULL REFERENCES "VSusercontrolist" (id) ON DELETE CASCADE,
    kind        VARCHAR(10)  NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (post_id, user_id, kind),
    CONSTRAINT chk_post_reaction_kind CHECK (kind IN ('LIKE','SAVE'))
);

-- "Meus salvos" e eliminação LGPD por usuário
CREATE INDEX IF NOT EXISTS idx_post_reaction_user
    ON post_reaction (user_id, kind, created_at DESC);

-- =============================================================================
-- Comentários (caixa de mensagens do post). Remoção é lógica: o corpo é apagado e o
-- contador decrementado, mantendo o id para auditoria de moderação.
-- =============================================================================

CREATE TABLE IF NOT EXISTS post_comment (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    post_id         UUID           NOT NULL REFERENCES post (id) ON DELETE CASCADE,
    author_user_id  BIGINT         NOT NULL REFERENCES "VSusercontrolist" (id),
    body            VARCHAR(2000),                     -- NULL depois de removido
    status          VARCHAR(10)    NOT NULL DEFAULT 'VISIBLE',
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),
    removed_at      TIMESTAMPTZ,
    CONSTRAINT chk_post_comment_status CHECK (status IN ('VISIBLE','REMOVED')),
    CONSTRAINT chk_post_comment_body
        CHECK ((status = 'VISIBLE' AND body IS NOT NULL AND length(btrim(body)) > 0)
            OR (status = 'REMOVED' AND body IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_post_comment_post
    ON post_comment (post_id, id) WHERE status = 'VISIBLE';
CREATE INDEX IF NOT EXISTS idx_post_comment_author
    ON post_comment (author_user_id);

-- =============================================================================
-- Compartilhamentos: um por (post, usuário, canal). share_count conta pares distintos,
-- então repetir o mesmo compartilhamento não infla o número.
-- user_id vira NULL na eliminação LGPD; o total agregado continua correto.
-- =============================================================================

CREATE TABLE IF NOT EXISTS post_share (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    post_id     UUID         NOT NULL REFERENCES post (id) ON DELETE CASCADE,
    user_id     BIGINT       REFERENCES "VSusercontrolist" (id) ON DELETE SET NULL,
    channel     VARCHAR(20)  NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uk_post_share_user_channel UNIQUE (post_id, user_id, channel),
    CONSTRAINT chk_post_share_channel
        CHECK (channel IN ('COPY_LINK','NATIVE','WHATSAPP','TELEGRAM','X','EMAIL'))
);

CREATE INDEX IF NOT EXISTS idx_post_share_user
    ON post_share (user_id);
