
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
