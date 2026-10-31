// Foto de perfil (RF2) e do post (RF29): pede a URL pré-assinada e envia direto ao bucket; o perfil grava a chave na
// hora, o post a leva no mediaObjectKey.
import { uploadToBucket, type Api, type ProfileView } from '@orange-social/api';

export const PHOTO_TYPES = ['image/jpeg', 'image/png'] as const;
/** MediaUploads.MAX_IMAGE_BYTES: 10 MB. */
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

/** Confere no navegador o que a API confere de novo: JPEG ou PNG, até 10 MB. */
export function checkPhoto(file: { type: string; size: number }): string | null {
  if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) return 'Envie a foto em JPEG ou PNG.';
  if (file.size < 1) return 'O arquivo está vazio. Escolha outra foto.';
  if (file.size > PHOTO_MAX_BYTES) return 'A foto vai até 10 MB.';
  return null;
}

export interface PhotoDeps {
  api: Pick<Api, 'media' | 'me'>;
  upload?: typeof uploadToBucket;
}

/** POST /api/v1/media/uploads → PUT na URL pré-assinada (com os cabeçalhos recebidos) → PUT /api/v1/me/photo. */
export async function uploadProfilePhoto(file: File, { api, upload = uploadToBucket }: PhotoDeps): Promise<ProfileView> {
  const ticket = await api.media.requestUpload({ kind: 'IMAGE', contentType: file.type, sizeBytes: file.size });
  await upload(ticket, file);
  return api.me.setPhoto(ticket.objectKey);
}

export interface PostPhotoDeps {
  api: Pick<Api, 'media'>;
  upload?: typeof uploadToBucket;
}

/**
 * Foto do post (RF29): POST /api/v1/media/uploads → PUT na URL pré-assinada. Devolve a chave do envio, que vai no
 * {@code mediaObjectKey} do post; a API limpa a foto (sem EXIF/GPS) quando o post é gravado.
 */
export async function uploadPostPhoto(file: File, { api, upload = uploadToBucket }: PostPhotoDeps): Promise<string> {
  const ticket = await api.media.requestUpload({ kind: 'IMAGE', contentType: file.type, sizeBytes: file.size });
  await upload(ticket, file);
  return ticket.objectKey;
}

/** Iniciais do nome (sem foto): "Júlia Andrade" → "JA". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0]![0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? '') : '';
  return (first + last).toUpperCase();
}
