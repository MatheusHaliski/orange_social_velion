// Tipos escritos à mão a partir dos records Java (o Jackson serializa com os mesmos nomes de campo).
// Fonte de cada bloco indicada no comentário; ao mudar um record, mude aqui no mesmo PR.
// ⏳ = contrato proposto para uma rota que o backend ainda não tem (a tela usa e o e2e simula; ver README).

// ------------------------------------------------------------ conta (application/account/AccountViews.java)

/** UserCategoryEnum: as 6 categorias (cor + glifo + rótulo, DESIGN_SYSTEM.md §4). */
export type CategoryCode = 'VERDE' | 'AMARELO' | 'AZUL' | 'LARANJA' | 'VERMELHO' | 'PRETO';

export type CategoryVerification = 'NOT_REQUIRED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

export type AccountStatus =
  | 'PENDING_VERIFICATION'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'PENDING_DELETION'
  | 'ANONYMOUS_LGPD_DELETED';

/** AccountViews.CategoryView e PostViews.CategoryView: {@code color} é a do tema escuro; a tela usa os tokens. */
export interface CategoryView {
  code: CategoryCode;
  label: string;
  color: string;
}

/** AccountViews.SessionUserView (GET /api/v1/auth/session). */
export interface SessionUserView {
  id: number;
  name: string;
  handle: string;
  email: string;
  category: CategoryView;
  categoryVerification: CategoryVerification;
  accountStatus: AccountStatus;
  emailVerified: boolean;
  mfaEnabled: boolean;
  /** Menor de 16 (ECA Digital): proteções travadas. */
  minor: boolean;
  termsUpToDate: boolean;
}

export type LoginStatus = 'AUTHENTICATED' | 'MFA_REQUIRED' | 'REACTIVATION_AVAILABLE';

/** AccountViews.LoginResult. */
export interface LoginResult {
  status: LoginStatus;
  user: SessionUserView | null;
  /** Instant em ISO-8601. */
  deletionScheduledFor: string | null;
  message: string | null;
}

/** AccountViews.TermsView (GET /api/v1/legal/terms). */
export interface TermsView {
  version: string;
  url: string;
}

/** AuthController.csrf. */
export interface CsrfView {
  headerName: string;
  token: string;
}

/** AuthController.RegisterRequest; {@code dateOfBirth} em AAAA-MM-DD. */
export interface RegisterRequest {
  name: string;
  handle: string;
  email: string;
  password: string;
  userType: CategoryCode;
  dateOfBirth: string;
  acceptTerms: boolean;
  termsVersion: string;
  typeDetails: Record<string, string>;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// ------------------------------------------------------------ Configurações (RF2 · RF3 · RF27 · RF23)

/** AccountViews.ProfileView (GET/PATCH /api/v1/me/profile): o perfil completo, só para o titular. */
export interface ProfileView {
  id: number;
  name: string;
  handle: string;
  email: string;
  recoveryEmail: string | null;
  cellphoneNumber: string | null;
  /** AAAA-MM-DD; só muda pelo suporte. */
  dateOfBirth: string | null;
  gender: string | null;
  bio: string | null;
  pronouns: string[];
  links: string[];
  countryOfResidence: string | null;
  stateOfResidence: string | null;
  cityOfResidence: string | null;
  category: CategoryView;
  categoryVerification: CategoryVerification;
  typeDetails: Record<string, unknown>;
  avatarObjectKey: string | null;
  avatarUrl: string | null;
}

/** ProfileService.ProfilePatch: campo ausente (ou null) fica como está. */
export interface ProfilePatch {
  name?: string;
  handle?: string;
  bio?: string;
  pronouns?: string[];
  links?: string[];
  countryOfResidence?: string;
  stateOfResidence?: string;
  cityOfResidence?: string;
  gender?: string;
  recoveryEmail?: string;
  cellphoneNumber?: string;
  typeDetails?: Record<string, string>;
}

/** UserPreference.Theme, AppBackground, CommentAudience e SensitiveContent. */
export type ThemePreference = 'SYSTEM' | 'DARK' | 'LIGHT';
export type AppBackground =
  | 'PLAIN'
  | 'NETWORK'
  | 'MOSAIC'
  | 'MOSAIC_CLASSIC'
  | 'MOSAIC_DEEP'
  | 'MOSAIC_GLOW'
  | 'MOSAIC_SKY'
  | 'MOSAIC_SAND';
export type CommentAudience = 'EVERYONE' | 'FOLLOWERS' | 'NOBODY';
export type SensitiveContent = 'LIMIT' | 'ALLOW';
/** Chaves de PreferencesService.NOTIFICATION_KEYS. */
export type NotificationKey = 'likes' | 'comments' | 'shares' | 'officialAlerts';

/** AccountViews.PreferencesView (GET/PATCH /api/v1/me/preferences). */
export interface PreferencesView {
  theme: ThemePreference;
  appBackground: AppBackground;
  language: string;
  /** 85 a 150 (%). */
  fontScale: number;
  reduceMotion: boolean;
  profilePrivate: boolean;
  whoCanComment: CommentAudience;
  showBirthYear: boolean;
  /** Feed que abre primeiro (Segmented Switcher, OS-31). */
  defaultFeed: FeedType;
  sensitiveContent: SensitiveContent;
  /** 10 a 600; null = sem lembrete. */
  usageReminderMinutes: number | null;
  notifications: Partial<Record<NotificationKey, boolean>>;
  loginAlerts: boolean;
  /** Menor de 16 (ECA Digital): afrouxar uma proteção dá 403. */
  minorProtectionsLocked: boolean;
}

/** PreferencesService.PreferencesPatch: campo ausente fica como está. */
export interface PreferencesPatch {
  theme?: ThemePreference;
  appBackground?: AppBackground;
  language?: string;
  fontScale?: number;
  reduceMotion?: boolean;
  profilePrivate?: boolean;
  whoCanComment?: CommentAudience;
  showBirthYear?: boolean;
  defaultFeed?: FeedType;
  sensitiveContent?: SensitiveContent;
  usageReminderMinutes?: number;
  clearUsageReminder?: boolean;
  notifications?: Partial<Record<NotificationKey, boolean>>;
  loginAlerts?: boolean;
}

/** Finalidades opcionais do tratamento (consent_event.purpose, RF3), todas desligadas por padrão. */
export type ConsentPurpose =
  | 'MARKETING'
  | 'LOCATION_TRACKING'
  | 'PERSONALIZED_FEED'
  | 'THIRD_PARTY_SHARING'
  | 'FACIAL_RECOGNITION'
  | 'SENSITIVE_PROFILE_DATA';

/** Um consentimento (GET /api/v1/me/consents, PUT /api/v1/me/consents/{purpose}) — API em portagem (RF3). */
export interface ConsentView {
  purpose: ConsentPurpose;
  label: string;
  description: string;
  legalBasis: string;
  sensitive: boolean;
  granted: boolean;
  /** Instant em ISO-8601; null se nunca mudou. */
  updatedAt: string | null;
  /** Menor de 16: o PUT dá 403. */
  lockedForMinor: boolean;
}

export interface ConsentList {
  items: ConsentView[];
}

/** MeController.SudoRequest (modo sudo, StepUp): senha atual e, com 2FA ativo, o código. */
export interface SudoRequest {
  password: string;
  code: string | null;
}

/** MeController.PasswordChange. */
export interface PasswordChange {
  currentPassword: string;
  code: string | null;
  newPassword: string;
}

/** SessionService.SessionView: uma sessão ativa, com um identificador (HMAC) que não é o id real. */
export interface SessionView {
  id: string;
  /** "Chrome no Windows"; pode faltar. */
  device: string | null;
  /** WEB, ANDROID, IOS… */
  channel: string | null;
  createdAt: string;
  lastAccessAt: string;
  current: boolean;
}

/** AccountViews.MfaStatusView. */
export interface MfaStatusView {
  enabled: boolean;
  enabledAt: string | null;
  recoveryCodesLeft: number;
}

/** AccountViews.MfaSetupView: some ao confirmar ou depois de expiresAt. */
export interface MfaSetupView {
  secret: string;
  otpauthUri: string;
  issuer: string;
  account: string;
  expiresAt: string;
}

/** AccountViews.RecoveryCodesView: mostrados uma única vez. */
export interface RecoveryCodesView {
  codes: string[];
  generatedAt: string;
}

/** MeController.DeletionRequest (POST /api/v1/me/deletion). */
export interface DeletionRequest {
  password: string;
  code: string | null;
  confirm: boolean;
}

/** AccountViews.DeletionView (202). */
export interface DeletionView {
  accountStatus: AccountStatus;
  deletionScheduledFor: string;
  graceDays: number;
}

/** MediaType. */
export type MediaKind = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO';

/** MediaUploadController.UploadRequest. */
export interface UploadRequest {
  kind: MediaKind;
  contentType: string;
  sizeBytes: number;
}

/** MediaUploads.UploadTicket: URL pré-assinada para o PUT direto ao bucket. */
export interface UploadTicket {
  objectKey: string;
  uploadUrl: string;
  method: string;
  headers: Record<string, string>;
  expiresAt: string;
  maxBytes: number;
}

// ------------------------------------------------------------ erros (api/ApiExceptionHandler.java)

/** Problem Details (RFC 9457) com {@code errors[]} no 422. */
export interface Problem {
  type?: string;
  title?: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: string[];
}

// ------------------------------------------------------------ posts (application/post/PostViews.java, RF24 · RF25 · RF26)

/** FeedType: os 4 feeds do Segmented Switcher. */
export type FeedType = 'PROFILE' | 'POST' | 'AUDIO' | 'ALERT';
export type PostStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'REMOVED';
export type AgeRatingCode = 'LIVRE' | 'AGE_12' | 'AGE_16' | 'AGE_18' | 'SENSITIVE';
export type ShareChannelCode = 'COPY_LINK' | 'NATIVE' | 'WHATSAPP' | 'TELEGRAM' | 'X' | 'EMAIL';

/** PostViews.AuthorView: {@code profilePath} nulo = conta eliminada ou suspensa, o nome fica sem link. */
export interface AuthorView {
  id: number | null;
  name: string;
  category: CategoryView | null;
  avatarUrl: string | null;
  profilePath: string | null;
  available: boolean;
}

export interface CountersView {
  likes: number;
  comments: number;
  shares: number;
  views: number;
}

/** Estado dos botões para quem está vendo; tudo false para visitante. */
export interface ViewerStateView {
  liked: boolean;
  saved: boolean;
  isAuthor: boolean;
}

/** BackgroundService.ContainerView: {@code contrast} já formatado ("12,1:1"). */
export interface FrameContainerView {
  color: string;
  ink: string;
  contrast: string;
}

/** BackgroundService.AuraPlusMedia: vídeo em loop + pôster; toca no máximo {@code maxPlaySeconds}. */
export interface AuraPlusMedia {
  poster: string;
  av1: string;
  h264: string;
  loopSeconds: number;
  maxPlaySeconds: number;
}

export type FrameArtKind = 'COLOR' | 'GRADIENT' | 'SEASONAL' | 'AURA' | 'AURA_PLUS' | 'LAYOUT' | 'NONE';

/** BackgroundService.BackgroundView: a moldura resolvida (RF28); {@code config} é a forma canônica gravada. */
export interface BackgroundView {
  config: FrameConfig;
  artKind: FrameArtKind;
  artId: string | null;
  palette: string[];
  css: string | null;
  auraPlus: AuraPlusMedia | null;
  container: FrameContainerView;
}

/** Severidade do alerta (CAP 1.2). ⏳ AlertContent ainda não existe no backend (OS-25, OS-34). */
export type AlertSeverity = 'EXTREME' | 'SEVERE' | 'MODERATE' | 'MINOR';
export type AlertCategory = 'EMERGENCY' | 'NATURAL_DISASTER' | 'OFFICIAL_COMMUNICATION' | 'JOB_OPENING';

/** ⏳ Dados do alerta no card do Alert Feed (proposta a partir da TAXONOMIA §3.4 e do CAP 1.2). */
export interface AlertInfoView {
  category: AlertCategory;
  severity: AlertSeverity | null;
  /** "Chuva forte"; null na vaga. */
  event: string | null;
  areaDesc: string | null;
  radiusKm: number | null;
  expiresAt: string | null;
  instruction: string | null;
  verifiedSource: boolean;
}

/** ⏳ Indicador de tendência (ZSET trending:{feed}); o backend ainda não manda. */
export type TrendingCode = 'HOT' | 'RISING' | 'STABLE' | 'FALLING';

/** PostViews.PostDetailView (GET /api/v1/posts/{id}). */
export interface PostDetailView {
  id: string;
  feed: FeedType;
  mediaType: MediaKind;
  title: string;
  subtitle: string | null;
  body: string | null;
  mediaUrl: string | null;
  durationSeconds: number | null;
  ageRating: AgeRatingCode;
  ageRatingLabel: string;
  status: PostStatus;
  country: string | null;
  city: string | null;
  publishedAt: string;
  author: AuthorView;
  counts: CountersView;
  viewer: ViewerStateView;
  /** false = arquivado: ações desabilitadas com explicação. */
  interactionsOpen: boolean;
  shareUrl: string;
  background: BackgroundView | null;
  /** ⏳ só nos alertas, quando o Alert Feed existir. */
  alert?: AlertInfoView | null;
  /** ⏳ */
  trending?: TrendingCode | null;
}

/** PostViews.PostCardView: sem texto corrido (DESIGN_SYSTEM.md §6). */
export interface PostCardView {
  id: string;
  feed: FeedType;
  mediaType: MediaKind;
  title: string;
  subtitle: string | null;
  mediaUrl: string | null;
  durationSeconds: number | null;
  ageRating: AgeRatingCode;
  ageRatingLabel: string;
  status: PostStatus;
  publishedAt: string;
  author: AuthorView;
  counts: CountersView;
  viewer: ViewerStateView;
  /** Caminho da API (/api/v1/posts/{id}); a tela usa /posts/{id}. */
  detailPath: string;
  background: BackgroundView | null;
  /** ⏳ */
  alert?: AlertInfoView | null;
  /** ⏳ */
  trending?: TrendingCode | null;
}

/** PostViews.FeedPageView: {@code nextCursor} nulo = fim. */
export interface FeedPageView {
  items: PostCardView[];
  nextCursor: string | null;
}

/**
 * ⏳ GET /api/v1/posts (Post Feed e Alert Feed com os filtros dos 6 eixos, OS-35). Hoje só existe o feed do
 * autor (GET /api/v1/users/{id}/posts).
 */
export interface FeedParams {
  feed?: 'POST' | 'ALERT';
  /** Repetível: category=VERDE&category=AZUL. */
  category?: CategoryCode[];
  mediaType?: MediaKind;
  country?: string;
  city?: string;
  q?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  cursor?: string;
  limit?: number;
}

// ------------------------------------------------------------ publicar e editar (api/PostPublishingController.java, RF29)

/** PostPublishingController.NewPostRequest (POST /api/v1/posts). */
export interface PostDraft {
  feed?: FeedType;
  mediaType?: MediaKind;
  title: string;
  subtitle?: string | null;
  body?: string | null;
  ageRating?: AgeRatingCode | null;
  country?: string | null;
  city?: string | null;
  /** Moldura do RF28; null = padrão. ALERT não aceita moldura. */
  background?: FrameConfig | null;
  mediaObjectKey?: string | null;
}

/** PATCH /api/v1/posts/{id}: chave ausente mantém; {@code "background": null} volta à moldura padrão. */
export type PostPatch = Partial<Pick<PostDraft, 'title' | 'subtitle' | 'body' | 'ageRating' | 'country' | 'city' | 'background'>>;

// ------------------------------------------------------------ interações (PostViews.java, RF26)

export interface CommentView {
  id: number;
  author: AuthorView;
  body: string;
  createdAt: string;
  canDelete: boolean;
}

/** {@code nextAfter} vai no parâmetro {@code after} da próxima página; nulo = fim. */
export interface CommentPageView {
  items: CommentView[];
  nextAfter: number | null;
  total: number;
}

export interface CommentCreatedView {
  comment: CommentView;
  comments: number;
}

export interface LikeStateView {
  liked: boolean;
  likes: number;
}

export interface SaveStateView {
  saved: boolean;
}

/** {@code counted}: primeira vez desta conta neste canal (só então o número sobe). */
export interface ShareResultView {
  shareUrl: string;
  channel: ShareChannelCode;
  shares: number;
  counted: boolean;
}

// ------------------------------------------------------------ perfis (PostViews.PublicProfileView, RF25)

/** Perfil público (RF25): minimização, só nome, categoria, foto e datas. */
export interface PublicProfileView {
  id: number;
  name: string;
  category: CategoryView;
  avatarUrl: string | null;
  memberSince: string;
  postCount: number;
  postsPath: string;
  /** Link público do perfil ({public-base-url}/u/{id}). */
  shareUrl: string;
}

/** ⏳ Card do Profile Feed (GET /api/v1/users): local só se a visibilidade do titular permitir. */
export interface ProfileCardView {
  id: number;
  name: string;
  category: CategoryView;
  verified: boolean;
  avatarUrl: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  interests: string[];
  profilePath: string;
}

export interface ProfilePageView {
  items: ProfileCardView[];
  nextCursor: string | null;
}

/** ⏳ GET /api/v1/users (Profile Feed, OS-35). */
export interface ProfileListParams {
  category?: CategoryCode[];
  country?: string;
  city?: string;
  q?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  cursor?: string;
  limit?: number;
}

// ------------------------------------------------------------ moldura (application/background/*, RF28)

export type FrameAuraVariant = 'ORIGINAL' | 'SUAVE';
export type FrameAuraFormat = 'IMAGEM_UNICA' | 'MOSAICO';
export type FrameLayoutId = 'CLASSICO' | 'POLAROID' | 'POSTER';
export type HypeStyle = 'OFF' | 'SCANNER' | 'BRILHO';
export type MetamorphoseMode = 'OFF' | 'PRISMA' | 'CONSTELACAO' | 'FIO_VIVO' | 'HOLOGRAFIA';

/** Configuração da moldura enviada no {@code background} do post (BackgroundValidator, v = 1). */
export interface FrameConfig {
  v: 1;
  color?: string | null;
  gradientId?: string | null;
  seasonal?: { presetId?: string | null; auto?: boolean } | null;
  animationId?: string | null;
  aura?: { presetId: string; variantId?: FrameAuraVariant; format?: FrameAuraFormat } | null;
  auraPlusId?: string | null;
  auraHypeStyle?: HypeStyle | null;
  metamorphose?: { mode?: MetamorphoseMode; presetId?: null } | null;
  materialId?: string | null;
  /** Arte própria (upload/IA): ⏳ OS-69/OS-70; o servidor ainda recusa. */
  customArt?: null;
  layoutId?: FrameLayoutId | null;
  skinId?: string | null;
  container?: { color?: string | null; ink?: string | null } | null;
}

/** BackgroundCatalog.Item: cor (id = #RRGGBB), gradiente, animação ou material. */
export interface FrameCatalogItem {
  id: string;
  name: string;
  css: string | null;
  palette: string[];
}

/** BackgroundCatalog.Aura: {@code css} nulo = arte gerada no cliente com a seed do post (Eclipse, Confete). */
export interface FrameAura {
  id: string;
  name: string;
  archetype: string;
  palette: string[];
  technique: string;
  css: string | null;
}

/** BackgroundCatalog.AuraPlus: vídeo AV1 + H.264 de reserva + pôster WebP. */
export interface FrameAuraPlus {
  id: string;
  name: string;
  archetype: string;
  poster: string;
  av1: string;
  h264: string;
  loopSeconds: number;
}

export interface FrameSeason {
  id: string;
  name: string;
  window: string;
  priority: number;
  colors: string[];
  /** false = só por escolha (Black Friday nunca entra no modo automático). */
  auto: boolean;
}

export interface FrameLayout {
  id: FrameLayoutId;
  name: string;
  /** true = o layout já traz arte própria (Pôster). */
  ownArt: boolean;
}

export interface FrameSkin {
  id: string;
  name: string;
  containerColor: string;
}

export interface FrameRules {
  minContrast: number;
  maxConfigBytes: number;
  maxAnimationSeconds: number;
  feedsWithoutFrame: FeedType[];
}

/** BackgroundCatalog.CatalogView (GET /api/v1/backgrounds/catalog, com ETag). */
export interface FrameCatalog {
  version: string;
  activeSeasonId: string | null;
  colors: FrameCatalogItem[];
  gradients: FrameCatalogItem[];
  seasons: FrameSeason[];
  animations: FrameCatalogItem[];
  auras: FrameAura[];
  auraPlus: FrameAuraPlus[];
  materials: FrameCatalogItem[];
  hypeStyles: HypeStyle[];
  metamorphoseModes: MetamorphoseMode[];
  layouts: FrameLayout[];
  skins: FrameSkin[];
  containerColors: FrameCatalogItem[];
  rules: FrameRules;
}

/** BackgroundService.Recommendation: aura + material, ou a cartela do dia. */
export interface FrameRecommendation {
  auraId: string | null;
  materialId: string | null;
  seasonId: string | null;
  reason: string;
}
