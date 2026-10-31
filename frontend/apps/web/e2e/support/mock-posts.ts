// Posts, interações, perfis e moldura na API simulada (RF24 · RF25 · RF26 · RF28 · RF29). Segue os records Java
// (PostViews, BackgroundCatalog, BackgroundService) e as regras que a tela precisa ver: 404 do post removido ou de
// rascunho alheio, 401 sem sessão, 409 do post arquivado, 422 com errors[]. As rotas ⏳ (GET /api/v1/posts e
// GET /api/v1/users) usam o contrato proposto em packages/api/src/types.ts.
import type {
  AlertInfoView,
  BackgroundView,
  CategoryCode,
  CommentView,
  FrameCatalog,
  FrameConfig,
  FrameRecommendation,
  PostCardView,
  PostDetailView,
  ProfileCardView,
  PublicProfileView,
  SessionUserView,
} from '@orange-social/api';
import { fromConfig, previewBackground, validateFrame } from '../../lib/frame';
import type { Recorded, Reply } from './mock-api';

type Fixture = <T>(name: string) => T;

export interface PostsHost {
  session: SessionUserView | null;
  uploads(): Set<string> | null;
}

function problem(status: number, detail: string, extra: Record<string, unknown> = {}): Reply {
  const titles: Record<number, string> = { 400: 'Pedido inválido', 401: 'Login necessário', 403: 'Sem permissão', 404: 'Não encontrado', 409: 'Interações encerradas', 422: 'Revise o post' };
  return { status, body: { type: 'about:blank', title: titles[status] ?? 'Erro', status, detail, ...extra } };
}

/** BackgroundService.BY_CATEGORY: aura + material sugeridos por categoria. */
const BY_CATEGORY: Record<CategoryCode, Array<[string, string]>> = {
  VERDE: [['eclipse', 'vidro'], ['colo', 'papel'], ['mare', 'cetim']],
  AMARELO: [['ouro-velho', 'metal'], ['entardecer', 'papel']],
  AZUL: [['asfalto', 'vidro'], ['eclipse', 'metal']],
  LARANJA: [['varanda', 'papel'], ['confete', 'cetim']],
  VERMELHO: [['ouro-velho', 'metal'], ['mare', 'vidro']],
  PRETO: [['eclipse', 'cetim'], ['confete', 'vidro']],
};

const LABELS: Record<string, string> = { LIVRE: 'Livre', AGE_12: '12+', AGE_16: '16+', AGE_18: '18+', SENSITIVE: 'Sensível' };

/** Post guardado no simulador: a moldura fica como configuração (o que o banco guarda). */
type StoredPost = Omit<PostDetailView, 'background'> & { background: FrameConfig | null };
type StoredProfile = PublicProfileView & Omit<ProfileCardView, 'profilePath'>;

/** As fixtures têm datas relativas ("MINUTES:12" = há 12 min, "TODAY:23" = hoje às 23h), resolvidas ao carregar. */
function resolveDates<T>(value: T): T {
  const now = Date.now();
  const text = JSON.stringify(value)
    .replace(/"MINUTES:(\d+)"/g, (_, m: string) => JSON.stringify(new Date(now - Number(m) * 60_000).toISOString()))
    .replace(/"TODAY:(\d+)"/g, (_, h: string) => {
      // hora cheia no fuso de São Paulo (UTC−3 fixo desde 2019), o mesmo do navegador nos testes
      const sp = new Date(now - 3 * 3_600_000);
      let t = Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), sp.getUTCDate(), Number(h) + 3);
      if (t < now) t += 86_400_000;
      return JSON.stringify(new Date(t).toISOString());
    });
  return JSON.parse(text) as T;
}

export class PostsState {
  posts: StoredPost[];
  comments: Map<string, CommentView[]>;
  profiles: StoredProfile[];
  readonly catalog: FrameCatalog;
  liked = new Set<string>();
  saved = new Set<string>();
  shared = new Set<string>();
  private nextComment = 100;
  private nextPost = 500;

  constructor(
    fixture: Fixture,
    private readonly host: PostsHost,
  ) {
    this.posts = resolveDates(fixture<StoredPost[]>('posts'));
    this.comments = new Map(Object.entries(resolveDates(fixture<Record<string, CommentView[]>>('comentarios'))));
    this.profiles = fixture<StoredProfile[]>('perfis');
    this.catalog = fixture<FrameCatalog>('catalogo-molduras');
  }

  post(id: string): StoredPost | undefined {
    return this.posts.find((p) => p.id === id);
  }

  private get viewerId(): number | null {
    return this.host.session?.id ?? null;
  }

  private background(config: FrameConfig | null): BackgroundView | null {
    if (!config) return null;
    return previewBackground(fromConfig(config), this.catalog);
  }

  /** O post como quem está vendo o recebe (viewer depende da sessão). */
  view(p: StoredPost): PostDetailView {
    const s = this.host.session;
    return {
      ...p,
      counts: { ...p.counts, comments: this.comments.get(p.id)?.length ?? p.counts.comments },
      viewer: { liked: !!s && this.liked.has(p.id), saved: !!s && this.saved.has(p.id), isAuthor: s?.id === p.author.id },
      interactionsOpen: p.status === 'PUBLISHED',
      background: this.background(p.background),
    };
  }

  card(p: StoredPost): PostCardView {
    const v = this.view(p);
    return {
      id: v.id,
      feed: v.feed,
      mediaType: v.mediaType,
      title: v.title,
      subtitle: v.subtitle,
      mediaUrl: v.mediaUrl,
      durationSeconds: v.durationSeconds,
      ageRating: v.ageRating,
      ageRatingLabel: v.ageRatingLabel,
      status: v.status,
      publishedAt: v.publishedAt,
      author: v.author,
      counts: v.counts,
      viewer: v.viewer,
      detailPath: `/api/v1/posts/${v.id}`,
      background: v.background,
      alert: v.alert ?? null,
      trending: v.trending ?? null,
    };
  }

  private page<T>(items: T[], sp: URLSearchParams): Reply {
    const limit = Number(sp.get('limit') ?? 10);
    const start = Number(sp.get('cursor') ?? 0);
    const slice = items.slice(start, start + limit);
    const next = start + limit < items.length ? String(start + limit) : null;
    return { status: 200, body: { items: slice, nextCursor: next } };
  }

  private sorted(items: StoredPost[]): StoredPost[] {
    return [...items].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  }

  private profile(id: number): StoredProfile | undefined {
    return this.profiles.find((x) => x.id === id);
  }

  /** Filtros dos 6 eixos (⏳ contrato proposto): categoria, tipo, local (raio, aqui = Curitiba), país, cidade e nome. */
  private matches(sp: URLSearchParams, item: { category: CategoryCode; media?: string; country: string | null; city: string | null; text: string }): boolean {
    const cats = sp.getAll('category');
    if (cats.length && !cats.includes(item.category)) return false;
    const media = sp.get('mediaType');
    if (media && item.media !== media) return false;
    const country = sp.get('country');
    if (country && item.country !== country) return false;
    const city = sp.get('city')?.toLowerCase();
    if (city && !(item.city ?? '').toLowerCase().includes(city)) return false;
    if (sp.get('radiusKm') && item.city !== 'Curitiba' && item.city !== 'Colombo') return false;
    const q = sp.get('q')?.toLowerCase();
    if (q && !item.text.toLowerCase().includes(q)) return false;
    return true;
  }

  handle(rec: Recorded): Reply | null {
    const { method: m, path: p } = rec;
    const s = this.host.session;

    if (m === 'GET' && p === '/api/v1/backgrounds/catalog') {
      return { status: 200, body: this.catalog, headers: { ETag: `"${this.catalog.version}-${this.catalog.activeSeasonId}"`, 'Cache-Control': 'max-age=3600, public' } };
    }
    if (m === 'GET' && p === '/api/v1/backgrounds/recommendations') {
      const category = (rec.search.get('category') ?? 'VERDE') as CategoryCode;
      const media = rec.search.get('media') ?? 'TEXT';
      const heavy = media === 'IMAGE' || media === 'VIDEO';
      const label = this.profiles.find((x) => x.category.code === category)?.category.label ?? category;
      const recs: FrameRecommendation[] = (BY_CATEGORY[category] ?? []).map(([auraId, materialId]) => ({
        auraId,
        materialId: heavy ? null : materialId,
        seasonId: null,
        reason: `Combina com ${label}${heavy ? ' e deixa a mídia em destaque' : ' e post de texto'}`,
      }));
      const season = this.catalog.seasons.find((x) => x.id === this.catalog.activeSeasonId);
      if (season) recs.push({ auraId: null, materialId: null, seasonId: season.id, reason: `Cartela da época: ${season.name}` });
      return { status: 200, body: recs };
    }

    // ⏳ Post Feed e Alert Feed
    if (m === 'GET' && p === '/api/v1/posts') {
      const feed = rec.search.get('feed') ?? 'POST';
      const items = this.sorted(this.posts)
        .filter((x) => x.feed === feed && x.status === 'PUBLISHED')
        .filter((x) =>
          this.matches(rec.search, {
            category: x.author.category?.code ?? 'VERDE',
            media: x.mediaType,
            country: x.country,
            city: x.city,
            text: `${x.title} ${x.author.name}`,
          }),
        )
        .map((x) => this.card(x));
      return this.page(items, rec.search);
    }

    if (m === 'POST' && p === '/api/v1/posts') return this.create(rec.body as Record<string, unknown>);

    const one = /^\/api\/v1\/posts\/([0-9a-f-]{36})(\/[a-z]+)?(\/(\d+))?$/.exec(p);
    if (one) {
      const [, id, sub, , commentId] = one;
      const post = this.post(id!);
      const isAuthor = !!s && post?.author.id === s.id;
      if (!post || post.status === 'REMOVED' || (post.status === 'DRAFT' && !isAuthor)) return problem(404, 'Post não encontrado.');
      if (!sub && m === 'GET') return { status: 200, body: this.view(post) };
      if (!s) return problem(401, 'Entre na sua conta para continuar.');
      if (!sub && m === 'PATCH') return isAuthor ? this.update(post, rec.body as Record<string, unknown>) : problem(403, 'Só quem publicou edita o post.');
      if (!sub && m === 'DELETE') {
        if (!isAuthor) return problem(403, 'Só quem publicou apaga o post.');
        post.status = 'REMOVED';
        return { status: 204 };
      }
      if (sub === '/archive' || sub === '/restore') {
        if (!isAuthor) return problem(403, 'Só quem publicou arquiva o post.');
        post.status = sub === '/archive' ? 'ARCHIVED' : 'PUBLISHED';
        return { status: 200, body: this.view(post) };
      }
      if (sub === '/comments' && m === 'GET' && !commentId) {
        const all = this.comments.get(post.id) ?? [];
        const after = Number(rec.search.get('after') ?? 0);
        const limit = Number(rec.search.get('limit') ?? 20);
        const items = all.filter((c) => c.id > after).slice(0, limit).map((c) => ({ ...c, canDelete: !!s && (c.author.id === s.id || isAuthor) }));
        const last = items.at(-1);
        const more = last ? all.some((c) => c.id > last.id) : false;
        return { status: 200, body: { items, nextAfter: more ? last!.id : null, total: all.length } };
      }
      if (s.accountStatus !== 'ACTIVE') return problem(403, 'Confirme seu e-mail para curtir, comentar e compartilhar.');
      const closed = post.status !== 'PUBLISHED';
      const officialAlert = post.feed === 'ALERT' && post.alert?.category !== 'JOB_OPENING';
      if (sub === '/like') {
        if (closed) return problem(409, 'Este post está arquivado: não recebe mais curtidas.');
        if (officialAlert) return problem(409, 'Alerta oficial não recebe curtidas.');
        if (m === 'PUT' && !this.liked.has(post.id)) {
          this.liked.add(post.id);
          post.counts.likes++;
        }
        if (m === 'DELETE' && this.liked.has(post.id)) {
          this.liked.delete(post.id);
          post.counts.likes--;
        }
        return { status: 200, body: { liked: this.liked.has(post.id), likes: post.counts.likes } };
      }
      if (sub === '/save') {
        if (m === 'PUT') this.saved.add(post.id);
        if (m === 'DELETE') this.saved.delete(post.id);
        return { status: 200, body: { saved: this.saved.has(post.id) } };
      }
      if (sub === '/comments' && m === 'POST') {
        if (closed) return problem(409, 'Este post está arquivado: os comentários estão fechados.');
        const text = String((rec.body as { body?: string })?.body ?? '').trim();
        if (!text) return problem(400, 'Escreva o comentário.');
        if (text.length > 2000) return problem(422, 'O comentário vai até 2.000 caracteres.', { errors: ['O comentário vai até 2.000 caracteres.'] });
        const me = this.profile(s.id);
        const c: CommentView = {
          id: this.nextComment++,
          author: { id: s.id, name: s.name, category: s.category, avatarUrl: me?.avatarUrl ?? null, profilePath: `/api/v1/users/${s.id}/profile`, available: true },
          body: text,
          createdAt: new Date().toISOString(),
          canDelete: true,
        };
        const list = [...(this.comments.get(post.id) ?? []), c];
        this.comments.set(post.id, list);
        return { status: 201, body: { comment: c, comments: list.length } };
      }
      if (sub === '/comments' && m === 'DELETE' && commentId) {
        const list = this.comments.get(post.id) ?? [];
        const c = list.find((x) => x.id === Number(commentId));
        // apagar de novo o mesmo comentário responde 404
        if (!c) return problem(404, 'Comentário não encontrado.');
        if (c.author.id !== s.id && !isAuthor) return problem(403, 'Só quem escreveu ou o dono do post apaga o comentário.');
        this.comments.set(post.id, list.filter((x) => x !== c));
        return { status: 204 };
      }
      if (sub === '/shares' && m === 'POST') {
        if (closed) return problem(409, 'Este post está arquivado.');
        const channel = String((rec.body as { channel?: string })?.channel);
        const key = `${post.id}:${channel}`;
        const counted = !this.shared.has(key);
        if (counted) {
          this.shared.add(key);
          post.counts.shares++;
        }
        return { status: 200, body: { shareUrl: post.shareUrl, channel, shares: post.counts.shares, counted } };
      }
    }

    // ⏳ Profile Feed
    if (m === 'GET' && p === '/api/v1/users') {
      const items: ProfileCardView[] = this.profiles
        .filter((x) => this.matches(rec.search, { category: x.category.code, country: x.country, city: x.city, text: x.name }))
        .map((x) => ({
          id: x.id,
          name: x.name,
          category: x.category,
          verified: x.verified,
          avatarUrl: x.avatarUrl,
          city: x.city,
          state: x.state,
          country: x.country,
          interests: x.interests,
          profilePath: `/api/v1/users/${x.id}/profile`,
        }));
      return this.page(items, rec.search);
    }

    const user = /^\/api\/v1\/users\/(\d+)\/(profile|posts)$/.exec(p);
    if (user && m === 'GET') {
      const id = Number(user[1]);
      const prof = this.profile(id);
      if (!prof) return problem(404, 'Perfil não encontrado.');
      const own = this.sorted(this.posts).filter((x) => x.author.id === id && (x.status === 'PUBLISHED' || x.status === 'ARCHIVED'));
      if (user[2] === 'profile') {
        const view: PublicProfileView = {
          id: prof.id,
          name: prof.name,
          category: prof.category,
          avatarUrl: prof.avatarUrl,
          memberSince: prof.memberSince,
          postCount: own.length,
          postsPath: prof.postsPath,
          shareUrl: prof.shareUrl,
        };
        return { status: 200, body: view };
      }
      return this.page(
        own.filter((x) => x.status === 'PUBLISHED' || x.author.id === this.viewerId).map((x) => this.card(x)),
        rec.search,
      );
    }
    return null;
  }

  // ------------------------------------------------------------ publicar e editar (PostPublishingService)

  private checkFields(d: Record<string, unknown>, errors: string[]): void {
    const title = String(d.title ?? '').trim();
    if (!title) errors.push('Dê um título ao post.');
    else if (title.length > 140) errors.push('O título vai até 140 caracteres.');
    if (String(d.subtitle ?? '').length > 280) errors.push('O subtítulo vai até 280 caracteres.');
    if (String(d.body ?? '').length > 5000) errors.push('O texto vai até 5000 caracteres.');
    if (d.country && !/^[A-Z]{2}$/.test(String(d.country))) errors.push('País em duas letras (ISO 3166), ex.: BR.');
    if (this.host.session?.minor && (d.ageRating === 'AGE_18' || d.ageRating === 'SENSITIVE')) errors.push('Menores de 18 anos não publicam conteúdo 18+ ou sensível.');
  }

  private checkFrame(config: unknown, errors: string[]): void {
    if (config === null || config === undefined) return;
    errors.push(...validateFrame(fromConfig(config as FrameConfig), this.catalog, 'POST'));
  }

  private create(d: Record<string, unknown>): Reply {
    const s = this.host.session;
    if (!s) return problem(401, 'Entre na sua conta para continuar.');
    if (s.accountStatus !== 'ACTIVE') return problem(403, 'Sua conta precisa estar ativa para publicar.');
    if (s.category.code === 'VERMELHO' && s.categoryVerification !== 'VERIFIED') return problem(403, 'Instituição publica depois da verificação do selo.');
    const errors: string[] = [];
    const media = d.mediaType ?? 'TEXT';
    const key = d.mediaObjectKey ? String(d.mediaObjectKey) : null;
    if (media === 'TEXT' && key) errors.push('Post de texto não leva mídia: use "mediaType": "IMAGE" para publicar a foto.');
    if (media === 'IMAGE' && (!key || !this.host.uploads()?.has(key))) errors.push('A foto não chegou ou o envio expirou. Envie a foto de novo.');
    if (media === 'VIDEO') errors.push('Vídeo ainda não: falta o processamento que tira os metadados e gera o pôster.');
    this.checkFields(d, errors);
    this.checkFrame(d.background, errors);
    if (errors.length) return problem(422, errors[0]!, { errors });
    if (key) this.host.uploads()?.delete(key);
    const id = `0199a1b2-c3d4-7e5f-8a9b-${String(this.nextPost++).padStart(12, '0')}`;
    const me = this.profile(s.id);
    const post: StoredPost = {
      id,
      feed: 'POST',
      mediaType: media as StoredPost['mediaType'],
      title: String(d.title).trim(),
      subtitle: (d.subtitle as string) ?? null,
      body: (d.body as string) ?? null,
      mediaUrl: key ? '/media-teste/posts/foto.png' : null,
      durationSeconds: null,
      ageRating: (d.ageRating as StoredPost['ageRating']) ?? 'LIVRE',
      ageRatingLabel: LABELS[String(d.ageRating ?? 'LIVRE')]!,
      status: 'PUBLISHED',
      country: (d.country as string) ?? null,
      city: (d.city as string) ?? null,
      publishedAt: new Date().toISOString(),
      author: { id: s.id, name: s.name, category: s.category, avatarUrl: me?.avatarUrl ?? null, profilePath: `/api/v1/users/${s.id}/profile`, available: true },
      counts: { likes: 0, comments: 0, shares: 0, views: 0 },
      viewer: { liked: false, saved: false, isAuthor: true },
      interactionsOpen: true,
      shareUrl: `http://localhost:3000/p/${id}`,
      background: (d.background as FrameConfig) ?? null,
      alert: null,
      trending: null,
    };
    this.posts.push(post);
    return { status: 201, body: this.view(post) };
  }

  private update(post: StoredPost, patch: Record<string, unknown>): Reply {
    const errors: string[] = [];
    const editable = ['title', 'subtitle', 'body', 'ageRating', 'country', 'city', 'background'];
    for (const k of Object.keys(patch)) if (!editable.includes(k)) errors.push(`Campo "${k}" não pode ser alterado por aqui.`);
    const merged = { ...post, ...patch };
    this.checkFields(merged, errors);
    if ('background' in patch) this.checkFrame(patch.background, errors);
    if (errors.length) return problem(422, errors[0]!, { errors });
    Object.assign(post, patch);
    if (patch.ageRating) post.ageRatingLabel = LABELS[String(patch.ageRating)]!;
    return { status: 200, body: this.view(post) };
  }
}

export type { AlertInfoView };
