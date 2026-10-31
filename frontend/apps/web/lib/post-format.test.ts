import { describe, expect, it } from 'vitest';
import { formatCompact, formatDuration, durationText } from './format';
import { alertHeadline, alertIssued, countsText, formatDateTime, formatRelative, formatUntil, profileHref, ratingText } from './post-format';
import { shareTarget } from './share';

describe('tempo do post', () => {
  const now = new Date('2026-10-25T15:00:00Z');
  it('relativo no card', () => {
    expect(formatRelative('2026-10-25T14:59:30Z', now)).toBe('agora');
    expect(formatRelative('2026-10-25T14:57:00Z', now)).toBe('há 3 min');
    expect(formatRelative('2026-10-25T12:30:00Z', now)).toBe('há 2 h');
    expect(formatRelative('2026-10-24T12:00:00Z', now)).toBe('ontem');
    expect(formatRelative('2026-10-21T12:00:00Z', now)).toBe('há 4 dias');
    expect(formatRelative('2026-10-12T12:00:00Z', now)).toMatch(/^12 de out/);
    expect(formatRelative('2025-10-12T12:00:00Z', now)).toMatch(/2025$/);
  });

  it('absoluto no fuso de quem vê; validade do alerta', () => {
    expect(formatDateTime('2026-10-25T14:20:00Z')).toMatch(/^25 de outubro de 2026 às \d{2}:20$/);
    const local = new Date(2026, 9, 25, 15, 0);
    expect(formatUntil(new Date(2026, 9, 25, 23, 0).toISOString(), local)).toBe('hoje, 23:00');
    expect(formatUntil(new Date(2026, 9, 26, 8, 0).toISOString(), local)).toBe('amanhã, 08:00');
    expect(alertIssued(new Date(local.getTime() - 120_000).toISOString(), local)).toBe('agora');
    expect(alertIssued(new Date(local.getTime() - 600_000).toISOString(), local)).toBe('há 10 min');
  });
});

describe('números e durações', () => {
  it('contagem compacta no card e exata no modal', () => {
    expect(formatCompact(2100)).toBe('2,1 mil');
    expect(formatCompact(57)).toBe('57');
  });

  it('duração em mm:ss e por extenso', () => {
    expect(formatDuration(768)).toBe('12:48');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(durationText(768)).toBe('12 minutos e 48 segundos');
  });
});

describe('contadores, classificação, alerta e links', () => {
  it('contadores em português, com singular', () => {
    expect(countsText({ likes: 1, comments: 0, shares: 2 })).toBe('1 curtida, 0 comentários, 2 compartilhamentos');
  });

  it('autor sem profilePath (conta excluída) não vira link', () => {
    expect(profileHref({ id: 310, profilePath: '/api/v1/users/310/profile' })).toBe('/u/310');
    expect(profileHref({ id: null, profilePath: null })).toBeNull();
  });

  it('classificação por extenso e cabeçalho do alerta (CAP)', () => {
    expect(ratingText('AGE_16', '16+')).toBe('Classificação: não recomendado para menores de 16 anos');
    expect(ratingText('LIVRE', 'Livre')).toMatch(/livre/);
    expect(alertHeadline({ category: 'NATURAL_DISASTER', severity: 'SEVERE', event: 'Chuva forte' } as never)).toBe('Alerta severo · Chuva forte');
    expect(alertHeadline({ category: 'JOB_OPENING', severity: null, event: null } as never)).toBe('Vaga');
  });

  it('canais de compartilhamento abrem o site certo com o link público', () => {
    const url = 'https://orange.social/p/abc';
    expect(shareTarget('WHATSAPP', url, 'PF')).toBe('https://wa.me/?text=PF%20https%3A%2F%2Forange.social%2Fp%2Fabc');
    expect(shareTarget('TELEGRAM', url, 'PF')).toBe('https://t.me/share/url?url=https%3A%2F%2Forange.social%2Fp%2Fabc&text=PF');
    expect(shareTarget('X', url, 'PF')).toContain('x.com/intent/post?url=');
    expect(shareTarget('EMAIL', url, 'PF')).toBe('mailto:?subject=PF&body=https%3A%2F%2Forange.social%2Fp%2Fabc');
    expect(shareTarget('COPY_LINK', url, 'PF')).toBeNull();
  });
});
