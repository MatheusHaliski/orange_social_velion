-- =============================================================================
-- Orange Social · MySQL 8.0 (fonte da verdade / ACID)
-- Tabela VSusercontrolist: cadastro, autenticação e perfil do usuário.
--
-- Mapeamento dos 19 campos de negócio -> coluna física:
--   Name                         -> name
--   Password                     -> password_hash            (BCrypt/Argon2, nunca texto puro)
--   Email                        -> email
--   Recoveryemail                -> recovery_email
--   Cityzenship                  -> citizenship
--   Country of residence         -> country_of_residence     (ISO 3166-1 alpha-2)
--   State of residence           -> state_of_residence
--   City of residence            -> city_of_residence
--   Address                      -> address
--   Cellphonenumber              -> cellphone_number         (E.164)
--   Listofinterestandhobbies     -> list_of_interests_and_hobbies   (JSON array)
--   Listofjobsinterests          -> list_of_jobs_interests          (JSON array)
--   Userdb                       -> user_date_of_birth       (data de nascimento)
--   Gender                       -> gender
--   sexualpreference             -> sexual_preference        (DADO SENSÍVEL · LGPD Art. 11)
--   Photo                        -> photo_object_key         (chave do objeto no S3/MinIO)
--   Usertype                     -> user_type                (ENUM de cores)
--   Listofcommunitiesofinterest  -> list_of_communities_of_interest (JSON array)
--   LastSavedLocation            -> last_saved_location      (JSON {lat, lng, timestamp})
--
-- Colunas técnicas adicionais: id, account_status, created_at, updated_at,
-- deleted_at, version (lock otimista).
-- =============================================================================

CREATE TABLE IF NOT EXISTS VSusercontrolist (
    id                              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,

    -- 1..4 · identificação e credenciais
    name                            VARCHAR(120)     NOT NULL,
    password_hash                   VARCHAR(255)     NOT NULL,
    email                           VARCHAR(254)     NOT NULL,
    recovery_email                  VARCHAR(254)     NULL,

    -- 5..9 · cidadania e residência
    citizenship                     VARCHAR(2)       NULL COMMENT 'ISO 3166-1 alpha-2',
    country_of_residence            VARCHAR(2)       NULL COMMENT 'ISO 3166-1 alpha-2',
    state_of_residence              VARCHAR(80)      NULL,
    city_of_residence               VARCHAR(120)     NULL,
    address                         VARCHAR(255)     NULL,

    -- 10 · contato
    cellphone_number                VARCHAR(20)      NULL COMMENT 'Formato E.164',

    -- 11..12 · interesses (JSON array de códigos da taxonomia)
    list_of_interests_and_hobbies   JSON             NULL COMMENT 'ex.: ["LIFESTYLE_FOOTBALL","LIFESTYLE_GAMES"]',
    list_of_jobs_interests          JSON             NULL COMMENT 'ex.: ["JOB_ENGINEERING","JOB_HEALTH"]',

    -- 13..15 · dados demográficos
    user_date_of_birth              DATE             NULL,
    gender                          VARCHAR(40)      NULL,
    sexual_preference               VARCHAR(40)      NULL COMMENT 'Dado sensível (LGPD Art. 5º II / Art. 11): opt-in explícito',

    -- 16 · mídia (objeto em AWS S3 / MinIO)
    photo_object_key                VARCHAR(512)     NULL COMMENT 'ex.: users/{id}/avatar/{uuid}.webp',

    -- 17 · categoria visual do usuário
    user_type                       ENUM('VERDE','AMARELO','AZUL','LARANJA','VERMELHO','PRETO')
                                                     NOT NULL DEFAULT 'VERDE',

    -- 18 · comunidades (typeofcommunity -> selectcountry -> selectcity)
    list_of_communities_of_interest JSON             NULL COMMENT 'ex.: [{"typeOfCommunity":"CHURCH","country":"BR","city":"Curitiba"}]',

    -- 19 · última localização GPS conhecida
    last_saved_location             JSON             NULL COMMENT '{"lat":-25.42,"lng":-49.27,"timestamp":"2026-10-17T12:00:00Z"}',

    -- técnicas / ciclo de vida
    account_status                  ENUM('PENDING_VERIFICATION','ACTIVE','SUSPENDED','ANONYMOUS_LGPD_DELETED')
                                                     NOT NULL DEFAULT 'PENDING_VERIFICATION',
    created_at                      DATETIME(6)      NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at                      DATETIME(6)      NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    deleted_at                      DATETIME(6)      NULL COMMENT 'Preenchido na eliminação (LGPD Art. 18, VI)',
    version                         BIGINT           NOT NULL DEFAULT 0,

    PRIMARY KEY (id),
    UNIQUE KEY uk_vsusercontrolist_email (email),
    KEY idx_vsusercontrolist_user_type (user_type),
    KEY idx_vsusercontrolist_location (country_of_residence, state_of_residence, city_of_residence),
    KEY idx_vsusercontrolist_status (account_status),

    CONSTRAINT chk_vsusercontrolist_interests_json
        CHECK (list_of_interests_and_hobbies IS NULL OR JSON_TYPE(list_of_interests_and_hobbies) = 'ARRAY'),
    CONSTRAINT chk_vsusercontrolist_jobs_json
        CHECK (list_of_jobs_interests IS NULL OR JSON_TYPE(list_of_jobs_interests) = 'ARRAY'),
    CONSTRAINT chk_vsusercontrolist_communities_json
        CHECK (list_of_communities_of_interest IS NULL OR JSON_TYPE(list_of_communities_of_interest) = 'ARRAY'),
    CONSTRAINT chk_vsusercontrolist_location_json
        CHECK (last_saved_location IS NULL OR JSON_TYPE(last_saved_location) = 'OBJECT')
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = 'Orange Social · cadastro de usuários (VSusercontrolist)';

-- =============================================================================
-- Consentimentos LGPD (Art. 7º, I · Art. 8º §5º · Art. 11)
-- Cada toggle da tela de configurações gera uma linha; revogar = granted=false
-- com revoked_at preenchido. Histórico preservado para prestação de contas
-- (princípio da responsabilização, Art. 6º, X).
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_consent (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id         BIGINT UNSIGNED NOT NULL,
    purpose         ENUM('MARKETING','LOCATION_TRACKING','PERSONALIZED_FEED',
                         'FACIAL_RECOGNITION','SENSITIVE_PROFILE_DATA','THIRD_PARTY_SHARING')
                                    NOT NULL,
    legal_basis     VARCHAR(40)     NOT NULL COMMENT 'ex.: ART_7_I, ART_11_I',
    granted         BOOLEAN         NOT NULL DEFAULT FALSE COMMENT 'Privacy by Default: desligado',
    policy_version  VARCHAR(20)     NOT NULL,
    granted_at      DATETIME(6)     NULL,
    revoked_at      DATETIME(6)     NULL,
    created_at      DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    KEY idx_user_consent_user_purpose (user_id, purpose),
    CONSTRAINT fk_user_consent_user
        FOREIGN KEY (user_id) REFERENCES VSusercontrolist (id) ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;
