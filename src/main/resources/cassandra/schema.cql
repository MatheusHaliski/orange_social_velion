-- =============================================================================
-- Orange Social · Apache Cassandra (escrita massiva)
-- Timeline de feeds (fan-out on write), logs de atividade e notificações.
-- =============================================================================

CREATE KEYSPACE IF NOT EXISTS orange_social
    WITH replication = {'class': 'NetworkTopologyStrategy', 'datacenter1': 3}
    AND durable_writes = true;

-- Timeline: uma partição por (dono da timeline, feed, bucket diário).
-- O bucket evita partições gigantes para usuários muito ativos.
CREATE TABLE IF NOT EXISTS orange_social.post_timeline (
    owner_user_id     bigint,
    feed_type         text,        -- PROFILE | POST | AUDIO | ALERT
    day_bucket        date,
    post_id           timeuuid,
    author_user_id    bigint,
    author_user_type  text,        -- VERDE | AMARELO | AZUL | LARANJA | VERMELHO | PRETO
    media_type        text,        -- TEXT | IMAGE | VIDEO | AUDIO
    title             text,
    subtitle          text,
    media_object_key  text,        -- chave no S3
    duration_seconds  int,         -- apenas Audio Feed
    country           text,
    city              text,
    created_at        timestamp,
    PRIMARY KEY ((owner_user_id, feed_type, day_bucket), post_id)
) WITH CLUSTERING ORDER BY (post_id DESC)
  AND default_time_to_live = 7776000   -- 90 dias; histórico completo fica no PostgreSQL/S3
  AND compaction = {'class': 'TimeWindowCompactionStrategy',
                    'compaction_window_unit': 'DAYS',
                    'compaction_window_size': 1};

CREATE TABLE IF NOT EXISTS orange_social.activity_log (
    user_id       bigint,
    day_bucket    date,
    event_id      timeuuid,
    action        text,           -- LOGIN, POST_PUBLISHED, CONSENT_REVOKED, DATA_EXPORTED ...
    target_id     text,
    metadata      map<text, text>,
    PRIMARY KEY ((user_id, day_bucket), event_id)
) WITH CLUSTERING ORDER BY (event_id DESC);

CREATE TABLE IF NOT EXISTS orange_social.notification (
    user_id         bigint,
    notification_id timeuuid,
    kind            text,         -- LIKE, COMMENT, ALERT, VELION_POINTS, TROPHY ...
    payload         text,         -- JSON
    read            boolean,
    PRIMARY KEY ((user_id), notification_id)
) WITH CLUSTERING ORDER BY (notification_id DESC)
  AND default_time_to_live = 2592000;  -- 30 dias
