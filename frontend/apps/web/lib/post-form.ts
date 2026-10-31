// Formulário de publicar e editar post (RF29): os mesmos limites do PostPublishingService, checados antes de
// enviar; o 422 do servidor continua sendo a palavra final (mapPostErrors).
import type { AgeRatingCode, FrameConfig, PostDetailView, PostDraft, PostPatch } from '@orange-social/api';

export const MAX_TITLE = 140;
export const MAX_SUBTITLE = 280;
export const MAX_BODY = 5000;
export const MAX_CITY = 120;

export const AGE_RATINGS: ReadonlyArray<{ code: AgeRatingCode; label: string; hint: string }> = [
  { code: 'LIVRE', label: 'Livre', hint: 'Para todos os públicos.' },
  { code: 'AGE_12', label: '12+', hint: 'Não recomendado para menores de 12 anos.' },
  { code: 'AGE_16', label: '16+', hint: 'Não recomendado para menores de 16 anos.' },
  { code: 'AGE_18', label: '18+', hint: 'Só para maiores de 18 anos.' },
  { code: 'SENSITIVE', label: 'Sensível', hint: 'Conteúdo sensível: aparece coberto para quem limita.' },
];

export interface PostFormValues {
  title: string;
  subtitle: string;
  body: string;
  ageRating: AgeRatingCode;
  country: string;
  city: string;
}

export type FormErrors = Record<string, string[]>;

export interface PhotoValue {
  /** Chave do envio novo (mediaObjectKey). */
  key: string | null;
}

export function emptyValues(): PostFormValues {
  return { title: '', subtitle: '', body: '', ageRating: 'LIVRE', country: 'BR', city: '' };
}

export function valuesFromPost(p: PostDetailView): PostFormValues {
  return {
    title: p.title,
    subtitle: p.subtitle ?? '',
    body: p.body ?? '',
    ageRating: p.ageRating,
    country: p.country ?? '',
    city: p.city ?? '',
  };
}

function add(errors: FormErrors, field: string, msg: string) {
  (errors[field] ??= []).push(msg);
}

/** Checagem local: título obrigatório e os limites do servidor. */
export function validateValues(v: PostFormValues): FormErrors {
  const errors: FormErrors = {};
  const title = v.title.trim();
  if (!title) add(errors, 'title', 'Dê um título ao post.');
  else if (title.length > MAX_TITLE) add(errors, 'title', `O título vai até ${MAX_TITLE} caracteres.`);
  if (v.subtitle.trim().length > MAX_SUBTITLE) add(errors, 'subtitle', `O subtítulo vai até ${MAX_SUBTITLE} caracteres.`);
  if (v.body.trim().length > MAX_BODY) add(errors, 'body', `O texto vai até ${MAX_BODY.toLocaleString('pt-BR')} caracteres.`);
  const country = v.country.trim();
  if (country && !/^[A-Za-z]{2}$/.test(country)) add(errors, 'country', 'País em duas letras (ISO 3166), ex.: BR.');
  if (v.city.trim().length > MAX_CITY) add(errors, 'city', `Cidade com até ${MAX_CITY} caracteres.`);
  return errors;
}

const orNull = (s: string) => (s.trim() ? s.trim() : null);

/** Valores → NewPostRequest; a foto vira mediaType IMAGE com a chave do envio. */
export function buildDraft(v: PostFormValues, photo: PhotoValue, background: FrameConfig | null): { draft: PostDraft; errors: FormErrors } {
  const draft: PostDraft = {
    feed: 'POST',
    mediaType: photo.key ? 'IMAGE' : 'TEXT',
    title: v.title.trim(),
    subtitle: orNull(v.subtitle),
    body: orNull(v.body),
    ageRating: v.ageRating,
    country: orNull(v.country)?.toUpperCase() ?? null,
    city: orNull(v.city),
    background,
  };
  if (photo.key) draft.mediaObjectKey = photo.key;
  return { draft, errors: validateValues(v) };
}

/** Só o que mudou (chave ausente mantém); {@code background: null} volta à moldura padrão. */
export function buildPatch(
  post: PostDetailView,
  v: PostFormValues,
  background: FrameConfig | null,
  frameChanged: boolean,
): { patch: PostPatch; errors: FormErrors } {
  const before = valuesFromPost(post);
  const patch: PostPatch = {};
  if (v.title.trim() !== before.title) patch.title = v.title.trim();
  if (v.subtitle.trim() !== before.subtitle) patch.subtitle = orNull(v.subtitle);
  if (v.body.trim() !== before.body) patch.body = orNull(v.body);
  if (v.ageRating !== before.ageRating) patch.ageRating = v.ageRating;
  if (v.country.trim().toUpperCase() !== before.country) patch.country = orNull(v.country)?.toUpperCase() ?? null;
  if (v.city.trim() !== before.city) patch.city = orNull(v.city);
  if (frameChanged) patch.background = background;
  return { patch, errors: validateValues(v) };
}
