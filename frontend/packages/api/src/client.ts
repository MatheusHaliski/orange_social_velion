// fetch com a sessão do navegador (cookie HttpOnly, nunca token em localStorage) e o CSRF no padrão SPA do
// Spring Security: o cookie XSRF-TOKEN volta no cabeçalho X-XSRF-TOKEN em toda escrita.
import type { Problem } from './types.ts';

export const CSRF_COOKIE = 'XSRF-TOKEN';
export const CSRF_HEADER = 'X-XSRF-TOKEN';
const CSRF_PATH = '/api/v1/auth/csrf';

/** Erro da API com o Problem Details já lido. */
export class ApiError extends Error {
  readonly status: number;
  readonly problem: Problem;
  /** Segundos do cabeçalho Retry-After (429), quando vier. */
  readonly retryAfterSeconds: number | null;

  constructor(status: number, problem: Problem, retryAfterSeconds: number | null) {
    super(problem.detail ?? problem.title ?? `Erro ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.problem = problem;
    this.retryAfterSeconds = retryAfterSeconds;
  }

  /** Mensagens do 422; vazio nos outros casos. */
  get errors(): string[] {
    return this.problem.errors ?? [];
  }

  /** Texto pronto para o usuário (o backend já manda em pt-BR). */
  get detail(): string {
    return this.problem.detail ?? this.message;
  }
}

export function isApiError(e: unknown, status?: number): e is ApiError {
  return e instanceof ApiError && (status === undefined || e.status === status);
}

export type QueryValue = string | number | boolean | null | undefined | ReadonlyArray<string | number>;

/** Monta a query string repetindo o nome para listas (cuisine=A&cuisine=B) e pulando vazios. */
export function toQuery(params: Record<string, QueryValue> | undefined): string {
  if (!params) return '';
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) {
      for (const item of v) q.append(k, String(item));
    } else {
      q.append(k, String(v));
    }
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export function readCookie(name: string, cookies: string = typeof document === 'undefined' ? '' : document.cookie): string | null {
  for (const part of cookies.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  if (Number.isFinite(n)) return Math.max(0, Math.ceil(n));
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

async function readProblem(res: Response): Promise<Problem> {
  const text = await res.text().catch(() => '');
  if (text) {
    try {
      const body = JSON.parse(text) as Partial<Problem>;
      return { ...body, status: body.status ?? res.status };
    } catch {
      // corpo que não é JSON (proxy, HTML de erro): cai na mensagem genérica
    }
  }
  return { status: res.status, detail: mensagemGenerica(res.status) };
}

function mensagemGenerica(status: number): string {
  if (status === 401) return 'Entre na sua conta para continuar.';
  if (status === 403) return 'Você não tem permissão para esta ação.';
  if (status === 404) return 'Não encontrado.';
  if (status === 429) return 'Muitas tentativas. Aguarde um pouco e tente de novo.';
  if (status >= 500) return 'Algo deu errado do nosso lado. Tente de novo mais tarde.';
  return 'Não foi possível concluir o pedido.';
}

export interface RequestOptions {
  query?: Record<string, QueryValue>;
  body?: unknown;
  signal?: AbortSignal;
}

export interface ApiResponse<T> {
  status: number;
  data: T;
}

export interface ClientOptions {
  /** Prefixo das URLs; vazio = mesma origem (o Next reescreve /api para o backend). */
  baseUrl?: string;
  fetch?: typeof fetch;
  /** Para testes: de onde ler os cookies. */
  cookies?: () => string;
}

const ESCRITA = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function createClient(options: ClientOptions = {}) {
  const baseUrl = options.baseUrl ?? '';
  const doFetch: typeof fetch = options.fetch ?? ((...args) => globalThis.fetch(...args));
  const cookies = options.cookies ?? (() => (typeof document === 'undefined' ? '' : document.cookie));
  let csrfPending: Promise<string | null> | null = null;
  let csrfFromBody: string | null = null;

  /** Garante o cookie XSRF-TOKEN; busca GET /auth/csrf só se ele ainda não existir (ou se forçado). */
  async function csrfToken(force = false): Promise<string | null> {
    const atual = readCookie(CSRF_COOKIE, cookies());
    if (atual && !force) return atual;
    csrfPending ??= (async () => {
      try {
        const res = await doFetch(`${baseUrl}${CSRF_PATH}`, {
          method: 'GET',
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        });
        if (res.ok) {
          const body = (await res.json().catch(() => null)) as { token?: string } | null;
          csrfFromBody = body?.token ?? null;
        }
      } finally {
        csrfPending = null;
      }
      // o cookie é o valor que o filtro SPA compara; o corpo só serve se o cookie não puder ser lido
      return readCookie(CSRF_COOKIE, cookies()) ?? csrfFromBody;
    })();
    return csrfPending;
  }

  async function request<T>(method: string, path: string, opts: RequestOptions = {}, retried = false): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const write = ESCRITA.has(method);
    if (write) {
      const token = await csrfToken();
      if (token) headers[CSRF_HEADER] = token;
    }
    let body: string | undefined;
    if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }
    const res = await doFetch(`${baseUrl}${path}${toQuery(opts.query)}`, {
      method,
      credentials: 'same-origin',
      headers,
      body,
      signal: opts.signal,
    });
    if (res.ok) {
      if (res.status === 204 || res.headers.get('Content-Length') === '0') {
        return { status: res.status, data: undefined as T };
      }
      // 202 pode vir com corpo (pedido de exclusão, RF23) ou sem (reenvio do código, RF1)
      const text = await res.text();
      return { status: res.status, data: (text ? JSON.parse(text) : undefined) as T };
    }
    const problem = await readProblem(res);
    // token CSRF velho (login e logout trocam o token): busca outro e tenta uma vez de novo
    if (write && res.status === 403 && problem.title === 'Sessão desatualizada' && !retried) {
      await csrfToken(true);
      return request<T>(method, path, opts, true);
    }
    throw new ApiError(res.status, problem, parseRetryAfter(res.headers.get('Retry-After')));
  }

  return {
    request,
    csrfToken,
    get: <T>(path: string, opts?: RequestOptions) => request<T>('GET', path, opts).then((r) => r.data),
    post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }).then((r) => r.data),
    put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
    patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }).then((r) => r.data),
    del: (path: string) => request<void>('DELETE', path).then(() => undefined),
    /** DELETE que devolve corpo (ex.: remover a foto devolve o perfil). */
    delJson: <T>(path: string) => request<T>('DELETE', path).then((r) => r.data),
  };
}

/** O que {@link uploadToBucket} precisa do UploadTicket. */
export interface PresignedPut {
  uploadUrl: string;
  method: string;
  headers: Record<string, string>;
}

/**
 * Envia o arquivo direto ao bucket pela URL pré-assinada (RF2): sem cookie nem CSRF (outra origem), com
 * exatamente os cabeçalhos assinados. O erro do S3 vem em XML, então vira uma mensagem em pt-BR.
 */
export async function uploadToBucket(ticket: PresignedPut, file: Blob, doFetch: typeof fetch = (...a) => globalThis.fetch(...a)): Promise<void> {
  let res: Response;
  try {
    res = await doFetch(ticket.uploadUrl, {
      method: ticket.method || 'PUT',
      headers: ticket.headers,
      body: file,
      credentials: 'omit',
    });
  } catch {
    throw new ApiError(0, { status: 0, detail: 'Não foi possível enviar a foto. Verifique a conexão e tente de novo.' }, null);
  }
  if (!res.ok) {
    const detail =
      res.status === 403
        ? 'O envio expirou ou não confere com a foto escolhida. Escolha a foto de novo.'
        : 'Não foi possível enviar a foto agora. Tente de novo.';
    throw new ApiError(res.status, { status: res.status, detail }, null);
  }
}

export type ApiClient = ReturnType<typeof createClient>;
