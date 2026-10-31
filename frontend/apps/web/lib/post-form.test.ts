import type { PostDetailView } from '@orange-social/api';
import { describe, expect, it } from 'vitest';
import { buildDraft, buildPatch, emptyValues, valuesFromPost, validateValues } from './post-form';

const post = {
  id: 'p1',
  title: 'Fim de tarde no Barigui',
  subtitle: null,
  body: 'Texto',
  ageRating: 'LIVRE',
  country: 'BR',
  city: 'Curitiba',
} as unknown as PostDetailView;

describe('publicar (RF29)', () => {
  it('título obrigatório e limites do servidor', () => {
    const e = validateValues({ ...emptyValues(), title: ' ', subtitle: 'x'.repeat(281), country: 'Bra', city: 'c'.repeat(121) });
    expect(Object.keys(e).sort()).toEqual(['city', 'country', 'subtitle', 'title']);
    expect(validateValues({ ...emptyValues(), title: 'Ok' })).toEqual({});
  });

  it('texto vira TEXT; com foto vira IMAGE com a chave', () => {
    const v = { ...emptyValues(), title: '  Olá  ', country: 'br' };
    expect(buildDraft(v, { key: null }, null).draft).toEqual({
      feed: 'POST',
      mediaType: 'TEXT',
      title: 'Olá',
      subtitle: null,
      body: null,
      ageRating: 'LIVRE',
      country: 'BR',
      city: null,
      background: null,
    });
    expect(buildDraft(v, { key: 'uploads/1/a.jpg' }, { v: 1, color: '#2B2217' }).draft).toMatchObject({
      mediaType: 'IMAGE',
      mediaObjectKey: 'uploads/1/a.jpg',
      background: { v: 1, color: '#2B2217' },
    });
  });
});

describe('editar (PATCH)', () => {
  it('manda só o que mudou; limpar vira null; moldura só se mudou', () => {
    const v = { ...valuesFromPost(post), title: 'Novo título', body: '', city: 'Curitiba' };
    expect(buildPatch(post, v, null, false).patch).toEqual({ title: 'Novo título', body: null });
    expect(buildPatch(post, valuesFromPost(post), null, true).patch).toEqual({ background: null });
  });
});
