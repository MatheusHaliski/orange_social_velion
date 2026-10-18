
-- =============================================================================
-- V4 · Moldura do post (RF28 · Background Studio)
--   post.background: só a configuração da moldura (ids do catálogo; nunca URL nem CSS),
--   validada pelo BackgroundValidator. NULL = moldura padrão.
-- =============================================================================

ALTER TABLE post ADD COLUMN IF NOT EXISTS background JSONB;

ALTER TABLE post ADD CONSTRAINT chk_post_background_json
    CHECK (background IS NULL OR (jsonb_typeof(background) = 'object' AND octet_length(background::text) <= 2048));

-- Alerta oficial nunca tem moldura: a faixa de alerta precisa ser reconhecida na hora
ALTER TABLE post ADD CONSTRAINT chk_post_alert_without_background
    CHECK (feed_type <> 'ALERT' OR background IS NULL);

COMMENT ON COLUMN post.background
    IS 'Moldura do post (RF28): {v, color, gradientId, seasonal, animationId, aura, auraPlusId, auraHypeStyle, metamorphose, materialId, customArt, layoutId, skinId, container}';
