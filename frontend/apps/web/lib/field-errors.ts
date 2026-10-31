// O 422 da API traz errors[] como frases em pt-BR (sem nome de campo estruturado). Aqui cada frase é
// associada ao campo do formulário pelo texto; o que não casar aparece no resumo do topo.

export interface MappedErrors {
  fields: Record<string, string[]>;
  general: string[];
}

type Rule = { test: RegExp; field: string };

function add(out: MappedErrors, field: string | null, msg: string) {
  if (!field) {
    out.general.push(msg);
    return;
  }
  (out.fields[field] ??= []).push(msg);
}

/** Troca "chave" pelo rótulo da tela: 'Preencha o campo "cnpj"' → 'Preencha o campo “CNPJ”'. */
function humanize(msg: string, labels: Record<string, string>): string {
  return msg.replace(/"(\w+)"/g, (m, key: string) => (labels[key] ? `“${labels[key]}”` : m));
}

const REGISTER_RULES: Rule[] = [
  // a senha vem antes: "A senha não pode conter seu e-mail ou @usuário" é erro de senha
  { test: /senha/i, field: 'password' },
  { test: /Termos de Uso/, field: 'acceptTerms' },
  { test: /nome de exibição/i, field: 'name' },
  { test: /@usuário/, field: 'handle' },
  { test: /^Informe um e-mail válido/, field: 'email' },
  { test: /^Não foi possível usar este e-mail/, field: 'email' },
  { test: /tipo de usuário/i, field: 'userType' },
  { test: /e-mail de um responsável/i, field: 'guardianEmail' },
  { test: /data de nascimento|para maiores de|responsável maior de 18/i, field: 'dateOfBirth' },
  { test: /CNPJ inválido|^Banco precisa de CNPJ/, field: 'cnpj' },
  { test: /^bcbCode/, field: 'bcbCode' },
  { test: /^eventStart|^Evento precisa/, field: 'eventStart' },
  { test: /^expiresAt/, field: 'expiresAt' },
  { test: /site completo/, field: 'website' },
];

/**
 * Cadastro (RF1): mensagens do RegistrationService, PasswordPolicy e UserTypeDetailsValidator.
 * {@code detailKeys} são os campos de type_details visíveis, com o rótulo de cada um.
 */
export function mapRegisterErrors(errors: string[], detailLabels: Record<string, string>): MappedErrors {
  const out: MappedErrors = { fields: {}, general: [] };
  for (const raw of errors) {
    const quoted = /"(\w+)"/.exec(raw)?.[1];
    if (quoted && detailLabels[quoted] && !/não se aplica/.test(raw)) {
      add(out, quoted, humanize(raw, detailLabels));
      continue;
    }
    const rule = REGISTER_RULES.find((r) => r.test.test(raw));
    add(out, rule?.field ?? null, humanize(raw, detailLabels));
  }
  return out;
}

const PROFILE_RULES: Rule[] = [
  { test: /nome de exibição/i, field: 'name' },
  { test: /@usuário/, field: 'handle' },
  { test: /\bbio\b/i, field: 'bio' },
  { test: /pronome/i, field: 'pronouns' },
  { test: /^Até 5 links/, field: 'links' },
  { test: /^País/, field: 'countryOfResidence' },
  { test: /e-mail de recuperação/i, field: 'recoveryEmail' },
  { test: /^Celular/, field: 'cellphoneNumber' },
  { test: /CNPJ inválido|^Banco precisa de CNPJ/, field: 'cnpj' },
  { test: /^bcbCode/, field: 'bcbCode' },
  { test: /^eventStart|^Evento precisa/, field: 'eventStart' },
  { test: /site completo/, field: 'website' },
];

/**
 * Perfil (RF2): mensagens do ProfileService e do UserTypeDetailsValidator. {@code detailLabels} são os campos do
 * tipo de conta visíveis, com o rótulo de cada um.
 */
export function mapProfileErrors(errors: string[], detailLabels: Record<string, string>): MappedErrors {
  const out: MappedErrors = { fields: {}, general: [] };
  for (const raw of errors) {
    const quoted = /"(\w+)"/.exec(raw)?.[1];
    if (quoted && detailLabels[quoted] && !/não se aplica/.test(raw)) {
      add(out, quoted, humanize(raw, detailLabels));
      continue;
    }
    const rule = PROFILE_RULES.find((r) => r.test.test(raw));
    add(out, rule?.field ?? null, humanize(raw, detailLabels));
  }
  return out;
}

/** Modo sudo (StepUp): 403 "Senha incorreta." ou "Senha ou código do app autenticador incorretos.". */
export function mapSudoError(detail: string, withCode: boolean): MappedErrors {
  const field = withCode && /código/.test(detail) ? 'code' : 'password';
  return { fields: { [field]: [detail] }, general: [] };
}

// ------------------------------------------------------------ post (RF29): mensagens do PostPublishingService, do
// MediaUploads e do BackgroundValidator (RF28). Os campos às vezes vêm entre aspas ("mediaObjectKey"); o resto, pelo texto.

/** Nome do campo do NewPostRequest → rótulo da tela. */
export const POST_FIELD_LABELS: Record<string, string> = {
  title: 'Título',
  subtitle: 'Subtítulo',
  body: 'Texto',
  mediaObjectKey: 'Foto',
  mediaType: 'Tipo de mídia',
  ageRating: 'Classificação',
  country: 'País',
  city: 'Cidade',
  background: 'Moldura',
};

const POST_RULES: Rule[] = [
  {
    test: /moldura|única arte|já traz arte própria|container|contraste|[Cc]artela|^Aura|^Gradiente desconhecido|^Animação|^Material desconhecido|^Skin|^Variação de aura|^Formato de aura|^Layout desconhecido|^Cor dos textos|^Arte própria|^Estilo de Aura Hype|^Metamorfose|^Presets de marcas|^Cor da moldura/i,
    field: 'background',
  },
  { test: /subtítulo/i, field: 'subtitle' },
  { test: /título/i, field: 'title' },
  { test: /^O texto vai até/, field: 'body' },
  { test: /foto|"mediaObjectKey"|imagem/i, field: 'photo' },
  { test: /18\+|sensível|[Cc]lassificação/, field: 'ageRating' },
  { test: /^País/, field: 'country' },
  { test: /^Cidade/, field: 'city' },
];

/** Campo citado entre aspas → campo da tela. */
const POST_QUOTED: Record<string, string> = {
  title: 'title',
  subtitle: 'subtitle',
  body: 'body',
  mediaObjectKey: 'photo',
  ageRating: 'ageRating',
  country: 'country',
  city: 'city',
  background: 'background',
};

/** Troca "mediaObjectKey" por “Foto”. */
export function humanizePostMessage(msg: string): string {
  return msg.replace(/"([\w.]+)"/g, (m, key: string) => (POST_FIELD_LABELS[key] ? `“${POST_FIELD_LABELS[key]}”` : m));
}

/** Publicar e editar post (RF29 · RF28): cada frase do 422 vai para o campo da tela; o resto, para o resumo. */
export function mapPostErrors(errors: string[], visible?: Set<string>): MappedErrors {
  const out: MappedErrors = { fields: {}, general: [] };
  for (const raw of errors) {
    const quoted = [...raw.matchAll(/"([\w.]+)"/g)].map((m) => POST_QUOTED[m[1]!]).find(Boolean);
    const target = quoted ?? POST_RULES.find((r) => r.test.test(raw))?.field;
    const field = target && (!visible || visible.has(target)) ? target : null;
    add(out, field, humanizePostMessage(raw));
  }
  return out;
}
