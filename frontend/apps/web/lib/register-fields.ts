// Campos de type_details por categoria, espelhando UserTypeDetailsValidator.java (RF1 · TAXONOMIA §3.3). Só as
// chaves da regra da categoria vão para a API: chave a mais é recusada (minimização).
import type { CategoryCode } from '@orange-social/api';

export interface DetailField {
  key: string;
  label: string;
  required: boolean;
  kind: 'text' | 'email' | 'url' | 'select' | 'uf' | 'document' | 'datetime' | 'date';
  options?: ReadonlyArray<{ value: string; label: string }>;
  hint?: string;
  autoComplete?: string;
  /** Nunca aparece no perfil público (PRIVATE_KEYS: titular + moderação). */
  private?: boolean;
}

const city = (required: boolean): DetailField => ({ key: 'city', label: 'Cidade', required, kind: 'text', autoComplete: 'address-level2' });
const state = (required: boolean): DetailField => ({ key: 'state', label: 'UF', required, kind: 'uf' });
const website = (required: boolean, label = 'Site'): DetailField => ({
  key: 'website',
  label,
  required,
  kind: 'url',
  hint: 'Endereço completo, começando com https://',
  autoComplete: 'url',
});
const cnpj = (required: boolean): DetailField => ({
  key: 'cnpj',
  label: 'CNPJ',
  required,
  kind: 'document',
  hint: '14 caracteres; desde 2026 o CNPJ pode ter letras.',
});
const legalName: DetailField = { key: 'legalName', label: 'Razão social', required: true, kind: 'text', autoComplete: 'organization' };
const PRIVATE_HINT = 'Privado: só você e a moderação veem.';

export const SUBTYPES: Partial<Record<CategoryCode, ReadonlyArray<{ value: string; label: string }>>> = {
  AMARELO: [
    { value: 'OUTLET', label: 'Veículo de imprensa' },
    { value: 'BLOG', label: 'Blog' },
    { value: 'FORUM', label: 'Fórum' },
    { value: 'NETWORKING', label: 'Networking' },
  ],
  VERMELHO: [
    { value: 'GOVERNMENT', label: 'Governo' },
    { value: 'COMPANY', label: 'Empresa' },
    { value: 'BRAND', label: 'Marca' },
  ],
  PRETO: [
    { value: 'CLOSE_FRIENDS', label: 'Amigos próximos' },
    { value: 'EVENT', label: 'Evento' },
    { value: 'SPECIAL_SITUATION', label: 'Situação especial' },
    { value: 'BANK', label: 'Banco' },
  ],
};

const subtype = (type: CategoryCode): DetailField => ({ key: 'subtype', label: 'Subtipo', required: true, kind: 'select', options: SUBTYPES[type] });

export const TYPE_FIELDS: Record<CategoryCode, DetailField[]> = {
  VERDE: [
    { key: 'occupation', label: 'Ocupação', required: false, kind: 'text', autoComplete: 'organization-title' },
    { key: 'education', label: 'Formação', required: false, kind: 'text' },
    website(false),
    city(false),
    state(false),
  ],
  AMARELO: [
    subtype('AMARELO'),
    { key: 'outletName', label: 'Nome do veículo, blog ou fórum', required: true, kind: 'text' },
    { key: 'role', label: 'Sua função', required: true, kind: 'text', hint: 'Ex.: repórter, editora, moderador.' },
    website(true),
    { key: 'mtbRegistration', label: 'Registro profissional (MTb)', required: false, kind: 'text', private: true, hint: PRIVATE_HINT },
    cnpj(false),
    city(false),
    state(false),
  ],
  AZUL: [
    {
      key: 'segment',
      label: 'Segmento',
      required: true,
      kind: 'select',
      options: [
        { value: 'AGENCY', label: 'Agência' },
        { value: 'ADVERTISER', label: 'Anunciante' },
        { value: 'CREATOR_COMPANY', label: 'Empresa de criador' },
      ],
    },
    cnpj(true),
    legalName,
    { key: 'tradeName', label: 'Nome fantasia', required: false, kind: 'text' },
    website(true),
    { key: 'contactName', label: 'Nome do responsável', required: true, kind: 'text', private: true, hint: PRIVATE_HINT },
    { key: 'contactRole', label: 'Cargo do responsável', required: true, kind: 'text', private: true },
    { key: 'contactEmail', label: 'E-mail do responsável', required: true, kind: 'email', private: true },
    city(false),
    state(false),
  ],
  LARANJA: [
    {
      key: 'communityType',
      label: 'Tipo de comunidade',
      required: true,
      kind: 'select',
      options: [
        { value: 'CHURCH', label: 'Igreja' },
        { value: 'SPORTS_CLUB', label: 'Clube esportivo' },
        { value: 'SOCIAL_CLUB', label: 'Clube social' },
        { value: 'COLLECTIVE', label: 'Coletivo' },
        { value: 'INFORMAL_GROUP', label: 'Grupo informal' },
        { value: 'OTHER', label: 'Outro' },
      ],
    },
    city(true),
    state(true),
    { key: 'contactName', label: 'Nome do responsável', required: true, kind: 'text', private: true, hint: PRIVATE_HINT },
    { key: 'contactEmail', label: 'E-mail do responsável', required: true, kind: 'email', private: true },
    { key: 'headquarters', label: 'Sede', required: false, kind: 'text' },
    cnpj(false),
    website(false),
  ],
  VERMELHO: [
    subtype('VERMELHO'),
    cnpj(true),
    legalName,
    { key: 'sector', label: 'Setor', required: true, kind: 'text' },
    website(true, 'Site oficial'),
    {
      key: 'size',
      label: 'Porte',
      required: false,
      kind: 'select',
      options: ['1-10', '11-50', '51-200', '201-1000', '1000+'].map((v) => ({ value: v, label: `${v} pessoas` })),
    },
    { key: 'representativeName', label: 'Nome do representante legal', required: true, kind: 'text', private: true, hint: PRIVATE_HINT },
    { key: 'representativeRole', label: 'Cargo do representante', required: true, kind: 'text', private: true },
    { key: 'representativeEmail', label: 'E-mail do representante', required: true, kind: 'email', private: true },
    { key: 'headquarters', label: 'Sede', required: false, kind: 'text' },
    city(false),
    state(false),
  ],
  PRETO: [
    subtype('PRETO'),
    { key: 'organizer', label: 'Organizador ou conta responsável', required: true, kind: 'text' },
    city(false),
    state(false),
    { key: 'expiresAt', label: 'A conta vale até', required: false, kind: 'date', hint: 'Para contas temporárias, como as de evento.' },
  ],
};

/** Evento e banco (PRETO) pedem mais campos (UserTypeDetailsValidator: "O se EVENT", "O se BANK"). */
function pretoExtras(sub: string): DetailField[] {
  if (sub === 'EVENT') {
    return [
      { key: 'eventName', label: 'Nome do evento', required: true, kind: 'text' },
      { key: 'eventStart', label: 'Início do evento', required: true, kind: 'datetime' },
      { key: 'eventLocation', label: 'Local do evento', required: true, kind: 'text' },
    ];
  }
  if (sub === 'BANK') {
    return [cnpj(true), { key: 'bcbCode', label: 'Código no Banco Central', required: true, kind: 'text', hint: '3 dígitos, ex.: 001.' }];
  }
  return [];
}

/** E-mail do responsável: obrigatório para menor de 16 (ECA Digital), só em Pessoa Física. */
export const GUARDIAN_FIELD: DetailField = {
  key: 'guardianEmail',
  label: 'E-mail do responsável',
  required: true,
  kind: 'email',
  private: true,
  hint: 'Para menores de 16 anos. A conta começa com as proteções mais fortes ligadas.',
};

export function fieldsFor(type: CategoryCode, sub: string, minorUnder16: boolean): DetailField[] {
  const base = TYPE_FIELDS[type];
  if (type === 'PRETO') {
    const extras = pretoExtras(sub);
    return [...base.slice(0, 2), ...extras, ...base.slice(2)];
  }
  return type === 'VERDE' && minorUnder16 ? [GUARDIAN_FIELD, ...base] : base;
}

/** datetime-local (hora de quem preenche) → ISO-8601 em UTC, como o validador pede. */
function toInstant(local: string): string {
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? local : d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Monta type_details só com as chaves da categoria, sem vazios. */
export function buildTypeDetails(fields: DetailField[], values: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const v = values[f.key]?.trim();
    if (v) out[f.key] = f.kind === 'datetime' ? toInstant(v) : v;
  }
  return out;
}
