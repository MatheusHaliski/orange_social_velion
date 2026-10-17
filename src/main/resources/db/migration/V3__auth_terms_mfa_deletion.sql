
-- =============================================================================
-- V3 · Cadastro, autenticação, 2FA, Termos de Uso e exclusão com carência
--   RF1  cadastro com aceite dos Termos de Uso da Velion e verificação de e-mail
--   RF27 sessão, autenticação, controle de acesso e 2FA (TOTP + códigos de recuperação)
--   RF23 excluir conta: 30 dias para reativar antes da eliminação definitiva
-- Sessões NÃO ficam no PostgreSQL: são opacas no Valkey (Spring Session · ADR-03).
-- =============================================================================

-- Exclusão com carência: PENDING_DELETION entra no ciclo de vida (docs/MAQUINA_ESTADOS.md §1)
ALTER TABLE "VSusercontrolist" DROP CONSTRAINT IF EXISTS chk_vsusercontrolist_status;
ALTER TABLE "VSusercontrolist" ADD CONSTRAINT chk_vsusercontrolist_status
    CHECK (account_status IN ('PENDING_VERIFICATION','ACTIVE','SUSPENDED','PENDING_DELETION','ANONYMOUS_LGPD_DELETED'));

ALTER TABLE "VSusercontrolist" ADD COLUMN IF NOT EXISTS email_verified_at      TIMESTAMPTZ;
ALTER TABLE "VSusercontrolist" ADD COLUMN IF NOT EXISTS deletion_requested_at  TIMESTAMPTZ;
ALTER TABLE "VSusercontrolist" ADD COLUMN IF NOT EXISTS deletion_scheduled_for TIMESTAMPTZ;
-- status ao qual a conta volta se o titular reativar dentro do prazo
ALTER TABLE "VSusercontrolist" ADD COLUMN IF NOT EXISTS status_before_deletion VARCHAR(30);

COMMENT ON COLUMN "VSusercontrolist".deletion_scheduled_for
    IS 'Fim da carência de 30 dias; depois disso a saga de eliminação (RF23) roda e não há volta';

-- Job diário de eliminação: só as contas cujo prazo venceu
CREATE INDEX IF NOT EXISTS idx_vsusercontrolist_deletion_due
    ON "VSusercontrolist" (deletion_scheduled_for)
    WHERE account_status = 'PENDING_DELETION';

-- =============================================================================
-- Aceite dos Termos de Uso da Velion (dona do Orange Social) — append-only.
-- Base legal: execução de contrato (LGPD Art. 7º, V). Cada nova versão aceita gera
-- uma linha; o histórico prova qual texto o usuário aceitou e quando.
-- =============================================================================

CREATE TABLE IF NOT EXISTS terms_acceptance (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      BIGINT       NOT NULL REFERENCES "VSusercontrolist" (id) ON DELETE CASCADE,
    document     VARCHAR(30)  NOT NULL,
    version      VARCHAR(20)  NOT NULL,
    accepted_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    channel      VARCHAR(20)  NOT NULL,              -- WEB, IOS, ANDROID
    ip_hash      VARCHAR(64),                        -- HMAC-SHA256 do IP (AppSecrets), nunca o IP em claro
    CONSTRAINT chk_terms_acceptance_document CHECK (document IN ('TERMS_OF_USE','PRIVACY_POLICY'))
);

CREATE INDEX IF NOT EXISTS idx_terms_acceptance_user
    ON terms_acceptance (user_id, document, accepted_at DESC);

-- =============================================================================
-- 2FA por aplicativo autenticador (TOTP · RFC 6238).
-- O segredo é cifrado na aplicação (AES-256-GCM) e nunca sai em claro depois da ativação.
-- last_used_step impede reusar o mesmo código dentro da janela (anti-replay).
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_mfa (
    user_id         BIGINT       PRIMARY KEY REFERENCES "VSusercontrolist" (id) ON DELETE CASCADE,
    totp_secret     BYTEA        NOT NULL,
    enabled_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    last_used_step  BIGINT       NOT NULL DEFAULT 0
);

-- Códigos de recuperação: mostrados uma única vez; guardados só como hash Argon2id
CREATE TABLE IF NOT EXISTS user_recovery_code (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT        NOT NULL REFERENCES "VSusercontrolist" (id) ON DELETE CASCADE,
    code_hash   VARCHAR(255)  NOT NULL,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    used_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_recovery_code_user
    ON user_recovery_code (user_id) WHERE used_at IS NULL;

-- =============================================================================
-- Perfil comum e campos por tipo de usuário (docs/PESQUISA_DADOS_USUARIO.md §2–3)
-- handle = @usuário público; type_details guarda os campos específicos de cada uma das 6 categorias
-- (validados na aplicação por UserTypeDetails); category_verification = selo da categoria.
-- =============================================================================

ALTER TABLE "VSusercontrolist" ADD COLUMN IF NOT EXISTS handle                VARCHAR(30);
ALTER TABLE "VSusercontrolist" ADD COLUMN IF NOT EXISTS bio                   VARCHAR(150);
ALTER TABLE "VSusercontrolist" ADD COLUMN IF NOT EXISTS pronouns              JSONB;
ALTER TABLE "VSusercontrolist" ADD COLUMN IF NOT EXISTS links                 JSONB;
ALTER TABLE "VSusercontrolist" ADD COLUMN IF NOT EXISTS type_details          JSONB;
ALTER TABLE "VSusercontrolist" ADD COLUMN IF NOT EXISTS category_verification VARCHAR(12) NOT NULL DEFAULT 'NOT_REQUIRED';

CREATE UNIQUE INDEX IF NOT EXISTS uk_vsusercontrolist_handle ON "VSusercontrolist" (handle);

ALTER TABLE "VSusercontrolist" DROP CONSTRAINT IF EXISTS chk_vsusercontrolist_handle;
ALTER TABLE "VSusercontrolist" ADD CONSTRAINT chk_vsusercontrolist_handle
    CHECK (handle IS NULL OR handle ~ '^[a-z0-9._]{3,30}$');
ALTER TABLE "VSusercontrolist" DROP CONSTRAINT IF EXISTS chk_vsusercontrolist_category_verification;
ALTER TABLE "VSusercontrolist" ADD CONSTRAINT chk_vsusercontrolist_category_verification
    CHECK (category_verification IN ('NOT_REQUIRED','PENDING','VERIFIED','REJECTED'));
ALTER TABLE "VSusercontrolist" DROP CONSTRAINT IF EXISTS chk_vsusercontrolist_type_details_json;
ALTER TABLE "VSusercontrolist" ADD CONSTRAINT chk_vsusercontrolist_type_details_json
    CHECK (type_details IS NULL OR jsonb_typeof(type_details) = 'object');

COMMENT ON COLUMN "VSusercontrolist".type_details
    IS 'Campos da categoria, ex.: {"subtype":"GOVERNMENT","cnpj":"…","legalName":"…","website":"…"}';

-- =============================================================================
-- Configurações e preferências (Configurações → 9 seções). Uma linha por usuário, criada no
-- cadastro. Menores de 16 (ECA Digital) nascem com o perfil privado e conteúdo sensível limitado.
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_preference (
    user_id                 BIGINT       PRIMARY KEY REFERENCES "VSusercontrolist" (id) ON DELETE CASCADE,
    -- Exibição e acessibilidade
    theme                   VARCHAR(10)  NOT NULL DEFAULT 'SYSTEM',
    app_background          VARCHAR(20)  NOT NULL DEFAULT 'PLAIN',
    language                VARCHAR(10)  NOT NULL DEFAULT 'pt-BR',
    font_scale              SMALLINT     NOT NULL DEFAULT 100,
    reduce_motion           BOOLEAN      NOT NULL DEFAULT FALSE,
    -- Privacidade
    profile_private         BOOLEAN      NOT NULL DEFAULT FALSE,
    who_can_comment         VARCHAR(10)  NOT NULL DEFAULT 'EVERYONE',
    show_birth_year         BOOLEAN      NOT NULL DEFAULT FALSE,
    -- Preferências de conteúdo e bem-estar
    default_feed            VARCHAR(10)  NOT NULL DEFAULT 'POST',
    sensitive_content       VARCHAR(10)  NOT NULL DEFAULT 'LIMIT',
    usage_reminder_minutes  SMALLINT,
    -- Notificações e segurança
    notifications           JSONB        NOT NULL DEFAULT '{"likes":true,"comments":true,"shares":true,"officialAlerts":true}',
    login_alerts            BOOLEAN      NOT NULL DEFAULT TRUE,
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_user_preference_theme       CHECK (theme IN ('SYSTEM','DARK','LIGHT')),
    CONSTRAINT chk_user_preference_background  CHECK (app_background IN
        ('PLAIN','NETWORK','MOSAIC','MOSAIC_CLASSIC','MOSAIC_DEEP','MOSAIC_GLOW','MOSAIC_SKY','MOSAIC_SAND')),
    CONSTRAINT chk_user_preference_font_scale  CHECK (font_scale BETWEEN 85 AND 150),
    CONSTRAINT chk_user_preference_comment     CHECK (who_can_comment IN ('EVERYONE','FOLLOWERS','NOBODY')),
    CONSTRAINT chk_user_preference_feed        CHECK (default_feed IN ('PROFILE','POST','AUDIO','ALERT')),
    CONSTRAINT chk_user_preference_sensitive   CHECK (sensitive_content IN ('LIMIT','ALLOW')),
    CONSTRAINT chk_user_preference_reminder    CHECK (usage_reminder_minutes IS NULL OR usage_reminder_minutes BETWEEN 10 AND 600),
    CONSTRAINT chk_user_preference_notif_json  CHECK (jsonb_typeof(notifications) = 'object')
);

COMMENT ON COLUMN user_preference.app_background
    IS 'Fundo do app: PLAIN (liso), NETWORK (logo em rede), MOSAIC (mosaico laranja, também o fundo do login) e MOSAIC_* — artes em design/brand/backgrounds/';
