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

CREATE TABLE IF NOT EXISTS "VSusercontrolist" (
    id                              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- 1..4 · identificação e credenciais
    name                            VARCHAR(120)  NOT NULL,
    password_hash                   VARCHAR(255)  NOT NULL,
    email                           VARCHAR(254)  NOT NULL,
    recovery_email                  VARCHAR(254),

    -- 5..9 · cidadania e residência
    citizenship                     CHAR(2),
    country_of_residence            CHAR(2),
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
    ON "VSusercontrolist" USING GIN (lower(unaccent(name)) gin_trgm_ops);
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
