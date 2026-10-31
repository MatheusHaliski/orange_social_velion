import { describe, expect, it, vi } from 'vitest';

type FetchArgs = [url: string, init: RequestInit & { headers: Record<string, string> }];
const mockFetch = (impl: (...args: FetchArgs) => Promise<Response>) => vi.fn<(...args: FetchArgs) => Promise<Response>>(impl);
const asFetch = (f: unknown) => f as typeof fetch;
import { ApiError, createClient, readCookie, toQuery, uploadToBucket } from './client.ts';
import { createApi } from './endpoints.ts';

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

describe('toQuery', () => {
  it('repete o nome nas listas e pula vazios', () => {
    expect(toQuery({ q: 'pão', cuisine: ['BRASILEIRA', 'MINEIRA'], price: [], minRating: 4, lat: undefined, sort: '' })).toBe(
      '?q=p%C3%A3o&cuisine=BRASILEIRA&cuisine=MINEIRA&minRating=4',
    );
    expect(toQuery({})).toBe('');
  });
});

describe('readCookie', () => {
  it('lê o valor decodificado', () => {
    expect(readCookie('XSRF-TOKEN', 'orange_session=abc; XSRF-TOKEN=a%2Fb=c')).toBe('a/b=c');
    expect(readCookie('XSRF-TOKEN', 'orange_session=abc')).toBeNull();
  });
});

describe('createClient', () => {
  it('GET não pede CSRF e usa a mesma origem', async () => {
    const fetch = vi.fn().mockResolvedValue(json(200, { ok: true }));
    const client = createClient({ fetch, cookies: () => '' });
    await expect(client.get('/api/v1/taxonomy')).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('/api/v1/taxonomy');
    expect(init.credentials).toBe('same-origin');
    expect(init.headers['X-XSRF-TOKEN']).toBeUndefined();
  });

  it('antes da primeira escrita busca /auth/csrf e manda o cookie no cabeçalho', async () => {
    let cookie = '';
    const fetch = mockFetch(async (url) => {
      if (url === '/api/v1/auth/csrf') {
        cookie = 'XSRF-TOKEN=tok-1';
        return json(200, { headerName: 'X-XSRF-TOKEN', token: 'mascarado' });
      }
      return json(200, { status: 'AUTHENTICATED' });
    });
    const api = createApi(createClient({ fetch: asFetch(fetch), cookies: () => cookie }));
    await api.auth.login({ email: 'a@b.com', password: 'x' });
    expect(fetch.mock.calls.map((c) => c[0])).toEqual(['/api/v1/auth/csrf', '/api/v1/auth/login']);
    const init = fetch.mock.calls[1]![1];
    expect(init.headers['X-XSRF-TOKEN']).toBe('tok-1');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(String(init.body))).toEqual({ email: 'a@b.com', password: 'x' });
  });

  it('com o cookie presente não busca o CSRF de novo', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = createClient({ fetch, cookies: () => 'XSRF-TOKEN=ja-tenho' });
    await client.del('/api/v1/establishments/1/reviews/me');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]![1].headers['X-XSRF-TOKEN']).toBe('ja-tenho');
  });

  it('token CSRF velho: busca outro e repete uma vez', async () => {
    let cookie = 'XSRF-TOKEN=velho';
    const fetch = mockFetch(async (url) => {
      if (url === '/api/v1/auth/csrf') {
        cookie = 'XSRF-TOKEN=novo';
        return json(200, { token: 'x' });
      }
      if (fetch.mock.calls.filter((c) => c[0] === url).length === 1) {
        return json(403, { status: 403, title: 'Sessão desatualizada', detail: 'Token CSRF ausente ou inválido.' });
      }
      return json(200, { id: 1 });
    });
    const client = createClient({ fetch: asFetch(fetch), cookies: () => cookie });
    await expect(client.post('/api/v1/auth/logout')).resolves.toEqual({ id: 1 });
    expect(fetch.mock.calls.at(-1)![1].headers['X-XSRF-TOKEN']).toBe('novo');
  });

  it('422 vira ApiError com errors[] e 429 traz o Retry-After', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json(422, { status: 422, title: 'Revise os dados', detail: 'Revise os campos destacados.', errors: ['a', 'b'] }))
      .mockResolvedValueOnce(json(429, { status: 429, detail: 'Muitas tentativas.' }, { 'Retry-After': '42' }));
    const client = createClient({ fetch, cookies: () => 'XSRF-TOKEN=t' });
    const e422 = await client.post('/x').catch((e: unknown) => e);
    expect(e422).toBeInstanceOf(ApiError);
    expect((e422 as ApiError).errors).toEqual(['a', 'b']);
    expect((e422 as ApiError).detail).toBe('Revise os campos destacados.');
    const e429 = (await client.post('/x').catch((e: unknown) => e)) as ApiError;
    expect(e429.status).toBe(429);
    expect(e429.retryAfterSeconds).toBe(42);
  });

  it('erro sem corpo JSON recebe mensagem em pt-BR', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('<html>', { status: 502 }));
    const err = (await createClient({ fetch }).get('/x').catch((e: unknown) => e)) as ApiError;
    expect(err.status).toBe(502);
    expect(err.detail).toMatch(/Algo deu errado/);
  });

  it('PUT da foto devolve o perfil; DELETE com corpo também', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json(200, { id: 9, avatarUrl: 'u' })).mockResolvedValueOnce(json(200, { id: 9, avatarUrl: null }));
    const api = createApi(createClient({ fetch, cookies: () => 'XSRF-TOKEN=t' }));
    await expect(api.me.setPhoto('uploads/9/a.jpg')).resolves.toMatchObject({ avatarUrl: 'u' });
    await expect(api.me.removePhoto()).resolves.toMatchObject({ avatarUrl: null });
    expect(fetch.mock.calls.map((c) => c[1].method)).toEqual(['PUT', 'DELETE']);
  });

  it('202 com corpo devolve o corpo (pedido de exclusão) e 202 vazio devolve undefined', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json(202, { accountStatus: 'PENDING_DELETION', deletionScheduledFor: '2026-11-24T12:00:00Z', graceDays: 30 }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }));
    const api = createApi(createClient({ fetch, cookies: () => 'XSRF-TOKEN=t' }));
    await expect(api.me.requestDeletion({ password: 'x', code: null, confirm: true })).resolves.toMatchObject({ graceDays: 30 });
    await expect(api.me.resendVerification()).resolves.toBeUndefined();
  });

  it('PATCH e DELETE com corpo mandam o CSRF e leem a resposta', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json(200, { fontScale: 120 })).mockResolvedValueOnce(json(200, { closed: 2 }));
    const api = createApi(createClient({ fetch, cookies: () => 'XSRF-TOKEN=t' }));
    await expect(api.me.updatePreferences({ fontScale: 120 })).resolves.toEqual({ fontScale: 120 });
    expect(fetch.mock.calls[0]![1].method).toBe('PATCH');
    expect(fetch.mock.calls[0]![1].headers['X-XSRF-TOKEN']).toBe('t');
    await expect(api.me.endOtherSessions()).resolves.toEqual({ closed: 2 });
    expect(fetch.mock.calls[1]![0]).toBe('/api/v1/me/sessions');
    expect(fetch.mock.calls[1]![1].method).toBe('DELETE');
  });
});

describe('uploadToBucket', () => {
  const ticket = { uploadUrl: 'https://bucket.exemplo/uploads/42/a.jpg?X-Amz-Signature=abc', method: 'PUT', headers: { 'Content-Type': 'image/jpeg' } };

  it('PUT direto, sem cookie nem CSRF, só com os cabeçalhos assinados', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const file = new Blob(['x'], { type: 'image/jpeg' });
    await uploadToBucket(ticket, file, fetch);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe(ticket.uploadUrl);
    expect(init).toMatchObject({ method: 'PUT', credentials: 'omit', headers: { 'Content-Type': 'image/jpeg' }, body: file });
  });

  it('403 do bucket vira mensagem em pt-BR', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('<Error/>', { status: 403 }));
    const err = (await uploadToBucket(ticket, new Blob(['x']), fetch).catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.detail).toMatch(/Escolha a foto de novo/);
  });
});

describe('posts, interações, perfis e moldura (RF24 · RF25 · RF26 · RF28 · RF29)', () => {
  it('feed por cursor: monta a query só com o que veio', async () => {
    const fetch = vi.fn().mockImplementation(async () => json(200, { items: [], nextCursor: null }));
    const api = createApi(createClient({ fetch, cookies: () => '' }));
    await api.posts.feed({ feed: 'POST', category: ['VERDE', 'AZUL'], mediaType: 'IMAGE', cursor: 'abc', limit: 10 });
    await api.posts.feed({ feed: 'ALERT' });
    await api.users.posts(5, { cursor: undefined, limit: 6 });
    await api.users.list({ category: ['PRETO'], city: 'Curitiba', q: '' });
    expect(fetch.mock.calls.map((c) => c[0])).toEqual([
      '/api/v1/posts?feed=POST&category=VERDE&category=AZUL&mediaType=IMAGE&cursor=abc&limit=10',
      '/api/v1/posts?feed=ALERT',
      '/api/v1/users/5/posts?limit=6',
      '/api/v1/users?category=PRETO&city=Curitiba',
    ]);
  });

  it('PATCH do post leva o null (limpa) e omite o ausente (mantém)', async () => {
    const fetch = vi.fn().mockResolvedValue(json(200, { id: 'p1' }));
    const api = createApi(createClient({ fetch, cookies: () => 'XSRF-TOKEN=t' }));
    await api.posts.update('p1', { title: 'Novo', background: null, subtitle: undefined });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('/api/v1/posts/p1');
    expect(init.method).toBe('PATCH');
    expect(init.headers['X-XSRF-TOKEN']).toBe('t');
    expect(JSON.parse(String(init.body))).toEqual({ title: 'Novo', background: null });
  });

  it('curtir é PUT e descurtir é DELETE com corpo; os dois com CSRF', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json(200, { liked: true, likes: 13 }))
      .mockResolvedValueOnce(json(200, { liked: false, likes: 12 }))
      .mockResolvedValueOnce(json(200, { saved: false }));
    const api = createApi(createClient({ fetch, cookies: () => 'XSRF-TOKEN=t' }));
    await expect(api.posts.like('p 1')).resolves.toEqual({ liked: true, likes: 13 });
    await expect(api.posts.unlike('p 1')).resolves.toEqual({ liked: false, likes: 12 });
    await expect(api.posts.unsave('p 1')).resolves.toEqual({ saved: false });
    expect(fetch.mock.calls.map((c) => [c[1].method, c[0]])).toEqual([
      ['PUT', '/api/v1/posts/p%201/like'],
      ['DELETE', '/api/v1/posts/p%201/like'],
      ['DELETE', '/api/v1/posts/p%201/save'],
    ]);
    expect(fetch.mock.calls.every((c) => c[1].headers['X-XSRF-TOKEN'] === 't')).toBe(true);
  });

  it('comentários paginam por after; compartilhar manda o canal; apagar devolve 204', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json(200, { items: [], nextAfter: null, total: 0 }))
      .mockResolvedValueOnce(json(200, { shareUrl: 'https://orange.social/p/p1', channel: 'WHATSAPP', shares: 3, counted: true }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const api = createApi(createClient({ fetch, cookies: () => 'XSRF-TOKEN=t' }));
    await api.posts.comments('p1', 41, 20);
    await expect(api.posts.share('p1', 'WHATSAPP')).resolves.toMatchObject({ counted: true });
    await expect(api.posts.removeComment('p1', 9)).resolves.toBeUndefined();
    expect(fetch.mock.calls[0]![0]).toBe('/api/v1/posts/p1/comments?after=41&limit=20');
    expect(JSON.parse(String(fetch.mock.calls[1]![1].body))).toEqual({ channel: 'WHATSAPP' });
    expect(fetch.mock.calls[2]![0]).toBe('/api/v1/posts/p1/comments/9');
  });

  it('recomendações da moldura levam a categoria, feed e mídia', async () => {
    const fetch = vi.fn().mockResolvedValue(json(200, []));
    const api = createApi(createClient({ fetch, cookies: () => '' }));
    await api.backgrounds.recommendations('LARANJA', 'POST', 'IMAGE');
    expect(fetch.mock.calls[0]![0]).toBe('/api/v1/backgrounds/recommendations?category=LARANJA&feed=POST&media=IMAGE');
  });
});
