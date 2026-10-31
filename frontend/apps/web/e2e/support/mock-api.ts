// API simulada para os testes ponta a ponta: intercepta /api/v1/** no navegador (page.route) e responde com as
// fixtures JSON de e2e/fixtures, que seguem os records Java. Guarda estado (sessão, CSRF, posts, Configurações) e
// registra cada pedido para os testes conferirem parâmetros, corpo e cabeçalhos.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BrowserContext, Page, Route } from '@playwright/test';
import { PostsState } from './mock-posts';
import type {
  CategoryCode,
  ConsentList,
  ConsentView,
  MfaSetupView,
  PreferencesPatch,
  PreferencesView,
  ProfilePatch,
  ProfileView,
  SessionUserView,
  SessionView,
} from '@orange-social/api';

const FIXTURES = fileURLToPath(new URL('../fixtures/', import.meta.url));

export function fixture<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(FIXTURES, `${name}.json`), 'utf8')) as T;
}

export interface Recorded {
  method: string;
  path: string;
  search: URLSearchParams;
  headers: Record<string, string>;
  body: unknown;
}

export interface Reply {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

type Handler = (req: Recorded, api: MockApi) => Reply | Promise<Reply>;

export const SENHA_CERTA = 'uma frase longa e segura';
/** Código do app autenticador que a API simulada aceita (no lugar do TOTP de verdade). */
export const CODIGO_2FA = '123456';
/** Origem da URL pré-assinada do bucket (outra origem, como o Garage/S3 de verdade). */
export const BUCKET_ORIGIN = 'http://media.localhost:3900';
/**
 * Bucket privado dos originais (orange-social.storage.uploads-bucket): a URL pré-assinada do PUT aponta para ele, não
 * para o bucket público de mídias (S3MediaStorage.bucketFor, uploads/ → privado).
 */
export const UPLOADS_BUCKET = 'orange-social-uploads';
/** Onde as fotos já tratadas ficam públicas (PublicLinks.mediaUrl). */
export const MEDIA_PUBLIC = '/media-teste/';
const AVATAR_PNG = fileURLToPath(new URL('../fixtures/avatar.png', import.meta.url));
const FOTO_PNG = fileURLToPath(new URL('../fixtures/foto.png', import.meta.url));
/** Foto para os testes de publicar (o mesmo PNG servido nas fotos dos posts). */
export const FOTO_FIXTURE = FOTO_PNG;

const CATEGORY_LABELS: Record<CategoryCode, [string, string]> = {
  VERDE: ['Pessoa Física', '#3DDC6B'],
  AMARELO: ['Networking', '#F7C948'],
  AZUL: ['Marketing', '#4A93FF'],
  LARANJA: ['Comunidade', '#FF9F1C'],
  VERMELHO: ['Instituição', '#FF4D4D'],
  PRETO: ['Especial', '#0C0A07'],
};

/** Finalidades travadas para menor de 16 (ConsentPurpose.MinorRule): as sensíveis (UNDER_18) vão até os 18; THIRD_PARTY_SHARING não trava. */
const LOCKED_UNDER_16 = new Set(['LOCATION_TRACKING', 'PERSONALIZED_FEED', 'MARKETING', 'SENSITIVE_PROFILE_DATA', 'FACIAL_RECOGNITION']);

/** Estado da conta logada: perfil, preferências, consentimentos, 2FA e sessões (Configurações, RF2 a RF23). */
export interface AccountState {
  profile: ProfileView;
  preferences: PreferencesView;
  consents: ConsentView[];
  mfa: { enabled: boolean; enabledAt: string | null; codes: string[]; setup: boolean };
  sessions: SessionView[];
  uploads: Set<string>;
  bucketPuts: Array<{ url: string; method: string; headers: Record<string, string>; size: number }>;
}

export function problem(status: number, detail: string, extra: Record<string, unknown> = {}): Reply {
  const titles: Record<number, string> = {
    401: 'Login necessário',
    403: 'Sem permissão',
    404: 'Não encontrado',
    409: 'Ação não disponível agora',
    422: 'Revise os dados',
    429: 'Muitas tentativas',
  };
  return { status, body: { type: 'about:blank', title: titles[status] ?? 'Erro', status, detail, ...extra } };
}

export class MockApi {
  readonly requests: Recorded[] = [];
  session: SessionUserView | null = null;
  csrfToken = `csrf-${Math.random().toString(36).slice(2)}`;
  private accountState: AccountState | null = null;
  /** Posts, comentários, perfis e moldura (RF29 · RF26 · RF24 · RF25 · RF28). */
  readonly posts: PostsState = this.makePosts();
  private overrides: Array<{ method: string; pattern: RegExp; handler: Handler }> = [];

  constructor(
    private readonly page: Page,
    private readonly context: BrowserContext,
  ) {}

  private makePosts(): PostsState {
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- o estado dos posts lê a sessão atual
    const host = this;
    return new PostsState(fixture, {
      get session() {
        return host.session;
      },
      uploads: () => (host.session ? host.account.uploads : null),
    });
  }

  async install(): Promise<void> {
    await this.context.route('**/api/v1/**', (route) => this.handle(route));
    await this.context.route(`${BUCKET_ORIGIN}/**`, (route) => this.bucket(route));
    await this.context.route(`**${MEDIA_PUBLIC}**`, (route) =>
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'image/png' },
        body: readFileSync(route.request().url().includes('/posts/') ? FOTO_PNG : AVATAR_PNG),
      }),
    );
  }

  /** Entra como a Ana (VERDE, ativa); {@code category} troca a categoria (com o rótulo e a cor do enum). */
  login(patch: Partial<SessionUserView> & { categoryCode?: CategoryCode } = {}): SessionUserView {
    const { categoryCode, ...rest } = patch;
    const base = fixture<SessionUserView>('sessao-usuario');
    const category = categoryCode ? { code: categoryCode, label: CATEGORY_LABELS[categoryCode][0], color: CATEGORY_LABELS[categoryCode][1] } : base.category;
    this.session = { ...base, category, ...rest };
    this.accountState = null;
    return this.session;
  }

  /** Estado das Configurações, criado a partir da sessão no primeiro uso; os testes podem mudar antes de abrir a tela. */
  get account(): AccountState {
    if (!this.session) throw new Error('login() antes de usar account');
    if (!this.accountState) {
      const s = this.session;
      const minor = s.minor;
      const profile: ProfileView = {
        ...fixture<ProfileView>('perfil'),
        id: s.id,
        name: s.name,
        handle: s.handle,
        email: s.email,
        category: s.category,
        categoryVerification: s.categoryVerification,
      };
      if (s.category.code !== 'VERDE') profile.typeDetails = {};
      if (minor) profile.typeDetails = { ...profile.typeDetails, guardianEmail: 'mae@example.com' };
      const prefs = fixture<PreferencesView>('preferencias');
      const preferences: PreferencesView = minor
        ? { ...prefs, profilePrivate: true, whoCanComment: 'FOLLOWERS', usageReminderMinutes: 60, minorProtectionsLocked: true }
        : prefs;
      const consents = fixture<ConsentList>('consentimentos').items.map((c) => ({ ...c, lockedForMinor: minor && LOCKED_UNDER_16.has(c.purpose) }));
      this.accountState = {
        profile,
        preferences,
        consents,
        mfa: { enabled: s.mfaEnabled, enabledAt: s.mfaEnabled ? '2026-09-01T12:00:00Z' : null, codes: s.mfaEnabled ? ['abcde-fghjk'] : [], setup: false },
        sessions: fixture<SessionView[]>('sessoes'),
        uploads: new Set(),
        bucketPuts: [],
      };
    }
    return this.accountState;
  }

  /** PUT na URL pré-assinada: confere o método e o Content-Type assinado, como o S3. */
  private async bucket(route: Route): Promise<void> {
    const req = route.request();
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'PUT',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (req.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    const url = new URL(req.url());
    const key = url.pathname.replace(new RegExp(`^/${UPLOADS_BUCKET}/`), '');
    const headers = await req.allHeaders();
    const size = req.postDataBuffer()?.length ?? 0;
    this.account.bucketPuts.push({ url: req.url(), method: req.method(), headers, size });
    if (req.method() !== 'PUT' || !url.searchParams.has('X-Amz-Signature')) {
      await route.fulfill({ status: 403, headers: cors, body: '<Error><Code>AccessDenied</Code></Error>' });
      return;
    }
    this.account.uploads.add(key);
    await route.fulfill({ status: 200, headers: { ...cors, ETag: '"teste"' }, body: '' });
  }

  /** Resposta específica de um teste; tem prioridade sobre as padrão. */
  on(method: string, pattern: RegExp, handler: Handler | Reply): void {
    this.overrides.unshift({ method, pattern, handler: typeof handler === 'function' ? handler : () => handler });
  }

  find(method: string, pathPattern: RegExp): Recorded[] {
    return this.requests.filter((r) => r.method === method && pathPattern.test(r.path));
  }

  last(method: string, pathPattern: RegExp): Recorded | undefined {
    return this.find(method, pathPattern).at(-1);
  }

  private async handle(route: Route): Promise<void> {
    const req = route.request();
    const url = new URL(req.url());
    let body: unknown = undefined;
    try {
      body = req.postDataJSON();
    } catch {
      body = req.postData();
    }
    const rec: Recorded = {
      method: req.method(),
      path: url.pathname,
      search: url.searchParams,
      headers: await req.allHeaders(),
      body,
    };
    this.requests.push(rec);
    const reply = await this.dispatch(rec, url.origin);
    await route.fulfill({
      status: reply.status,
      headers: {
        'Content-Type': reply.status >= 400 ? 'application/problem+json' : 'application/json',
        ...(reply.headers ?? {}),
      },
      body: reply.body === undefined ? '' : JSON.stringify(reply.body),
    });
  }

  private async dispatch(rec: Recorded, origin: string): Promise<Reply> {
    const write = !['GET', 'HEAD'].includes(rec.method);
    if (write && rec.headers['x-xsrf-token'] !== this.csrfToken) {
      return { status: 403, body: { title: 'Sessão desatualizada', status: 403, detail: 'Token CSRF ausente ou inválido. Recarregue a página e tente de novo.' } };
    }
    const o = this.overrides.find((x) => x.method === rec.method && x.pattern.test(rec.path));
    if (o) return o.handler(rec, this);
    return this.defaults(rec, origin);
  }

  private async defaults(rec: Recorded, origin: string): Promise<Reply> {
    const { method: m, path: p } = rec;

    if (m === 'GET' && p === '/api/v1/auth/csrf') {
      await this.context.addCookies([{ name: 'XSRF-TOKEN', value: this.csrfToken, url: origin }]);
      return { status: 200, body: { headerName: 'X-XSRF-TOKEN', token: `mascarado-${this.csrfToken}` } };
    }
    if (m === 'GET' && p === '/api/v1/auth/session') {
      return this.session ? { status: 200, body: this.session } : problem(401, 'Entre na sua conta para continuar.');
    }
    if (m === 'POST' && p === '/api/v1/auth/login') {
      const b = rec.body as { email?: string; password?: string };
      if (b?.password === SENHA_CERTA) {
        const user = this.login({ email: b.email ?? 'ana@example.com' });
        await this.rotateCsrf();
        return { status: 200, body: { status: 'AUTHENTICATED', user, deletionScheduledFor: null, message: null } };
      }
      return problem(401, 'E-mail ou senha incorretos.');
    }
    if (m === 'POST' && p === '/api/v1/auth/logout') {
      this.session = null;
      await this.rotateCsrf();
      return { status: 204 };
    }
    if (m === 'POST' && p === '/api/v1/auth/register') {
      const b = rec.body as { name: string; handle: string; email: string; userType: string };
      const code = b.userType as CategoryCode;
      this.session = {
        id: 77,
        name: b.name,
        handle: b.handle,
        email: b.email,
        category: { code, label: CATEGORY_LABELS[code]?.[0] ?? code, color: CATEGORY_LABELS[code]?.[1] ?? '#3DDC6B' },
        categoryVerification: code === 'VERMELHO' ? 'PENDING' : 'NOT_REQUIRED',
        accountStatus: 'PENDING_VERIFICATION',
        emailVerified: false,
        mfaEnabled: false,
        minor: false,
        termsUpToDate: true,
      };
      await this.rotateCsrf();
      return {
        status: 201,
        body: { status: 'AUTHENTICATED', user: this.session, deletionScheduledFor: null, message: `Enviamos um código de 6 dígitos para ${b.email}.` },
      };
    }
    if (m === 'GET' && p === '/api/v1/legal/terms') return { status: 200, body: fixture('termos') };

    const postsReply = this.posts.handle(rec);
    if (postsReply) return postsReply;

    if (m === 'POST' && p === '/api/v1/me/verify-email') {
      if (!this.session) return problem(401, 'Entre na sua conta para continuar.');
      if (this.session.emailVerified) return problem(409, 'Seu e-mail já está confirmado.');
      if ((rec.body as { code?: string })?.code !== '123456') return problem(422, 'Código incorreto. Restam 4 tentativas.', { errors: ['Código incorreto. Restam 4 tentativas.'] });
      this.session = { ...this.session, emailVerified: true, accountStatus: 'ACTIVE' };
      return { status: 200, body: this.session };
    }
    if (m === 'POST' && p === '/api/v1/me/verify-email/resend') {
      return this.session ? { status: 202 } : problem(401, 'Entre na sua conta para continuar.');
    }
    if (p.startsWith('/api/v1/me/') || p === '/api/v1/media/uploads') {
      const reply = this.accountRoute(rec);
      if (reply) return reply;
    }
    return problem(404, `Rota não simulada: ${m} ${p}`);
  }

  /** Modo sudo (StepUp): senha e, com 2FA, o código do app ou um de recuperação. */
  private sudo(password: unknown, code: unknown): Reply | null {
    const mfa = this.account.mfa;
    const okCode = !mfa.enabled || code === CODIGO_2FA || (typeof code === 'string' && mfa.codes.includes(code));
    if (password === SENHA_CERTA && okCode) return null;
    return problem(403, mfa.enabled ? 'Senha ou código do app autenticador incorretos.' : 'Senha incorreta.');
  }

  private accountRoute(rec: Recorded): Reply | null {
    const { method: m, path: p } = rec;
    if (!this.session) return problem(401, 'Entre na sua conta para continuar.');
    const acc = this.account;
    const body = (rec.body ?? {}) as Record<string, unknown>;

    // ---- perfil e foto (RF2)
    if (p === '/api/v1/me/profile' && m === 'GET') return { status: 200, body: acc.profile };
    if (p === '/api/v1/me/profile' && m === 'PATCH') return this.patchProfile(body as ProfilePatch);
    if (p === '/api/v1/media/uploads' && m === 'POST') {
      if (this.session.accountStatus !== 'ACTIVE') return problem(403, 'Sua conta precisa estar ativa para enviar fotos. Confirme seu e-mail ou fale com o suporte.');
      const errors: string[] = [];
      if (body.kind !== 'IMAGE') errors.push('Diga o tipo de mídia: IMAGE.');
      if (!['image/jpeg', 'image/png'].includes(String(body.contentType))) errors.push('Envie a foto em JPEG ou PNG.');
      if (typeof body.sizeBytes !== 'number' || body.sizeBytes < 1 || body.sizeBytes > 10 * 1024 * 1024) errors.push('A foto vai até 10 MB.');
      if (errors.length) return problem(422, errors[0]!, { title: 'Revise a foto', errors });
      const ext = body.contentType === 'image/png' ? 'png' : 'jpg';
      const objectKey = `uploads/${this.session.id}/0199${acc.uploads.size + 1}.${ext}`;
      return {
        status: 201,
        body: {
          objectKey,
          uploadUrl: `${BUCKET_ORIGIN}/${UPLOADS_BUCKET}/${objectKey}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=teste`,
          method: 'PUT',
          // S3MediaStorage.presignPut devolve os cabeçalhos assinados menos o host: Content-Type e Content-Length
          // (o navegador ignora o Content-Length do fetch, cabeçalho proibido, e manda o tamanho real do arquivo)
          headers: { 'Content-Type': String(body.contentType), 'Content-Length': String(body.sizeBytes) },
          expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
          maxBytes: 10 * 1024 * 1024,
        },
      };
    }
    if (p === '/api/v1/me/photo' && m === 'PUT') {
      const key = String(body.objectKey ?? '');
      if (!acc.uploads.has(key)) return problem(422, 'Envie a foto de novo.', { errors: ['Envie a foto de novo.'] });
      acc.uploads.delete(key);
      const publicKey = `avatars/0199-${Date.now()}.png`;
      acc.profile = { ...acc.profile, avatarObjectKey: publicKey, avatarUrl: `${MEDIA_PUBLIC}${publicKey}` };
      return { status: 200, body: acc.profile };
    }
    if (p === '/api/v1/me/photo' && m === 'DELETE') {
      acc.profile = { ...acc.profile, avatarObjectKey: null, avatarUrl: null };
      return { status: 200, body: acc.profile };
    }

    // ---- preferências (RF2, RF3)
    if (p === '/api/v1/me/preferences' && m === 'GET') return { status: 200, body: acc.preferences };
    if (p === '/api/v1/me/preferences' && m === 'PATCH') return this.patchPreferences(body as PreferencesPatch);

    // ---- consentimentos (RF3)
    if (p === '/api/v1/me/consents' && m === 'GET') return { status: 200, body: { items: acc.consents } };
    const consent = /^\/api\/v1\/me\/consents\/([A-Z_]+)$/.exec(p);
    if (consent && m === 'PUT') {
      const item = acc.consents.find((c) => c.purpose === consent[1]);
      if (!item) return problem(404, 'Finalidade desconhecida.');
      if (item.lockedForMinor) {
        return problem(403, item.sensitive ? 'Este uso de dado sensível só a partir dos 18 anos (LGPD Art. 14).' : 'Para menores de 16 anos este uso fica desligado (ECA Digital).');
      }
      const updated: ConsentView = { ...item, granted: body.granted === true, updatedAt: new Date().toISOString() };
      acc.consents = acc.consents.map((c) => (c.purpose === item.purpose ? updated : c));
      return { status: 200, body: updated };
    }

    // ---- senha e sessões (RF27)
    if (p === '/api/v1/me/password' && m === 'POST') {
      const denied = this.sudo(body.currentPassword, body.code);
      if (denied) return denied;
      if (typeof body.newPassword !== 'string' || body.newPassword.length < 12) {
        const msg = 'A senha precisa ter pelo menos 12 caracteres. Uma frase com várias palavras funciona bem.';
        return problem(422, msg, { errors: [msg] });
      }
      const closed = acc.sessions.filter((s) => !s.current).length;
      acc.sessions = acc.sessions.filter((s) => s.current);
      return { status: 200, body: { otherSessionsClosed: closed } };
    }
    if (p === '/api/v1/me/sessions' && m === 'GET') return { status: 200, body: acc.sessions };
    if (p === '/api/v1/me/sessions' && m === 'DELETE') {
      const closed = acc.sessions.filter((s) => !s.current).length;
      acc.sessions = acc.sessions.filter((s) => s.current);
      return { status: 200, body: { closed } };
    }
    const one = /^\/api\/v1\/me\/sessions\/([\w-]+)$/.exec(p);
    if (one && m === 'DELETE') {
      if (!acc.sessions.some((s) => s.id === one[1] && !s.current)) return { status: 404 };
      acc.sessions = acc.sessions.filter((s) => s.id !== one[1]);
      return { status: 204 };
    }

    // ---- 2FA (RF27)
    const status = () => ({ enabled: acc.mfa.enabled, enabledAt: acc.mfa.enabledAt, recoveryCodesLeft: acc.mfa.codes.length });
    const newCodes = () => {
      acc.mfa.codes = Array.from({ length: 10 }, (_, i) => `k${i}m2p-${(i + 3).toString().repeat(2)}x7q`.slice(0, 11));
      return { codes: acc.mfa.codes, generatedAt: new Date().toISOString() };
    };
    if (p === '/api/v1/me/mfa' && m === 'GET') return { status: 200, body: status() };
    if (p === '/api/v1/me/mfa/totp' && m === 'POST') {
      const denied = this.sudo(body.password, body.code);
      if (denied) return denied;
      if (acc.mfa.enabled) return problem(409, 'O 2FA já está ativo. Desative antes de configurar outro aparelho.');
      acc.mfa.setup = true;
      return { status: 200, body: fixture<MfaSetupView>('2fa-configuracao') };
    }
    if (p === '/api/v1/me/mfa/totp/confirm' && m === 'POST') {
      if (!acc.mfa.setup) return problem(422, 'A configuração expirou. Comece de novo.', { errors: ['A configuração expirou. Comece de novo.'] });
      if (body.code !== CODIGO_2FA) {
        const msg = 'Código incorreto. Confira a hora do celular e tente de novo.';
        return problem(422, msg, { errors: [msg] });
      }
      acc.mfa = { ...acc.mfa, enabled: true, enabledAt: new Date().toISOString(), setup: false };
      this.session = { ...this.session, mfaEnabled: true };
      return { status: 200, body: newCodes() };
    }
    if (p === '/api/v1/me/mfa/recovery-codes' && m === 'POST') {
      const denied = this.sudo(body.password, body.code);
      if (denied) return denied;
      if (!acc.mfa.enabled) return problem(409, 'Ative o 2FA primeiro.');
      return { status: 200, body: newCodes() };
    }
    if (p === '/api/v1/me/mfa/disable' && m === 'POST') {
      const denied = this.sudo(body.password, body.code);
      if (denied) return denied;
      acc.mfa = { enabled: false, enabledAt: null, codes: [], setup: false };
      this.session = { ...this.session, mfaEnabled: false };
      return { status: 200, body: status() };
    }

    // ---- excluir conta (RF23)
    if (p === '/api/v1/me/deletion' && m === 'POST') {
      if (body.confirm !== true) return problem(422, 'Confirme que entendeu as consequências da exclusão.', { errors: ['Confirme que entendeu as consequências da exclusão.'] });
      const denied = this.sudo(body.password, body.code);
      if (denied) return denied;
      this.session = null;
      return {
        status: 202,
        body: { accountStatus: 'PENDING_DELETION', deletionScheduledFor: new Date(Date.now() + 30 * 86_400_000).toISOString(), graceDays: 30 },
      };
    }
    return null;
  }

  private patchProfile(patch: ProfilePatch): Reply {
    const acc = this.account;
    const errors: string[] = [];
    const next: ProfileView = { ...acc.profile };
    if (patch.name != null) {
      if (patch.name.trim().length < 2 || patch.name.trim().length > 120) errors.push('Informe um nome de exibição com 2 a 120 caracteres.');
      else next.name = patch.name.trim();
    }
    if (patch.handle != null) {
      if (patch.handle === 'emuso') return problem(409, 'Esse @usuário já está em uso. Tente outro.');
      if (!/^[a-z0-9._]{3,30}$/.test(patch.handle)) errors.push('O @usuário deve ter 3 a 30 caracteres: letras minúsculas, números, ponto ou sublinhado.');
      else next.handle = patch.handle;
    }
    if (patch.bio != null) {
      if (patch.bio.length > 150) errors.push('A bio tem no máximo 150 caracteres.');
      else next.bio = patch.bio || null;
    }
    if (patch.pronouns != null) next.pronouns = patch.pronouns;
    if (patch.links != null) {
      if (patch.links.length > 5 || patch.links.some((l) => !/^https:\/\/\S{4,200}$/.test(l))) errors.push('Até 5 links, cada um começando com https://');
      else next.links = patch.links;
    }
    if (patch.countryOfResidence != null) next.countryOfResidence = patch.countryOfResidence || null;
    if (patch.stateOfResidence != null) next.stateOfResidence = patch.stateOfResidence || null;
    if (patch.cityOfResidence != null) next.cityOfResidence = patch.cityOfResidence || null;
    if (patch.recoveryEmail != null) next.recoveryEmail = patch.recoveryEmail || null;
    if (patch.cellphoneNumber != null) {
      if (patch.cellphoneNumber && !/^\+[1-9]\d{7,14}$/.test(patch.cellphoneNumber)) errors.push('Celular no formato internacional, ex.: +5541999990000.');
      else next.cellphoneNumber = patch.cellphoneNumber || null;
    }
    if (patch.typeDetails != null) next.typeDetails = patch.typeDetails;
    if (patch.gender != null) next.gender = patch.gender || null;
    if (errors.length) return problem(422, errors[0]!, { errors });
    acc.profile = next;
    if (this.session) this.session = { ...this.session, name: next.name, handle: next.handle };
    return { status: 200, body: next };
  }

  private patchPreferences(patch: PreferencesPatch): Reply {
    const acc = this.account;
    const minor = acc.preferences.minorProtectionsLocked;
    if (minor && (patch.profilePrivate === false || patch.sensitiveContent === 'ALLOW' || patch.whoCanComment === 'EVERYONE')) {
      return problem(403, 'Para menores de 16 anos essa proteção fica ligada; só o responsável pode alterá-la (ECA Digital).');
    }
    if (patch.clearUsageReminder && minor) return problem(403, 'Para menores de 16 anos o lembrete de tempo de uso fica ligado.');
    if (patch.fontScale != null && (patch.fontScale < 85 || patch.fontScale > 150)) {
      return problem(422, 'O tamanho da fonte vai de 85% a 150%.', { errors: ['O tamanho da fonte vai de 85% a 150%.'] });
    }
    const { clearUsageReminder, notifications, ...rest } = patch;
    const defined = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined && v !== null));
    acc.preferences = {
      ...acc.preferences,
      ...defined,
      usageReminderMinutes: clearUsageReminder ? null : (patch.usageReminderMinutes ?? acc.preferences.usageReminderMinutes),
      notifications: { ...acc.preferences.notifications, ...(notifications ?? {}) },
    };
    return { status: 200, body: acc.preferences };
  }

  /** Login e logout trocam o token CSRF, como o Spring Security faz. */
  private async rotateCsrf(): Promise<void> {
    this.csrfToken = `csrf-${Math.random().toString(36).slice(2)}`;
    await this.context.clearCookies({ name: 'XSRF-TOKEN' });
  }
}
