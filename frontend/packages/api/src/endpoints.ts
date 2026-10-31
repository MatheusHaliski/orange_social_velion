// Um método por rota da API usada pelo web (controllers em src/main/java/com/orangesocial/api/).
import { createClient, type ApiClient, type ClientOptions } from './client.ts';
import type {
  CategoryCode,
  CommentCreatedView,
  CommentPageView,
  ConsentList,
  ConsentPurpose,
  ConsentView,
  DeletionRequest,
  DeletionView,
  FeedPageView,
  FeedParams,
  FrameCatalog,
  FrameRecommendation,
  LikeStateView,
  LoginRequest,
  LoginResult,
  MediaKind,
  MfaSetupView,
  MfaStatusView,
  PasswordChange,
  PostDetailView,
  PostDraft,
  PostPatch,
  PreferencesPatch,
  PreferencesView,
  ProfileListParams,
  ProfilePageView,
  ProfilePatch,
  ProfileView,
  PublicProfileView,
  RecoveryCodesView,
  RegisterRequest,
  SaveStateView,
  SessionUserView,
  SessionView,
  ShareChannelCode,
  ShareResultView,
  SudoRequest,
  TermsView,
  UploadRequest,
  UploadTicket,
} from './types.ts';

const seg = (v: number | string) => encodeURIComponent(String(v));

export function createApi(client: ApiClient = createClient()) {
  const post = (id: string) => `/api/v1/posts/${seg(id)}`;
  return {
    client,

    auth: {
      /** AuthController.session: 401 sem sessão. */
      session: () => client.get<SessionUserView>('/api/v1/auth/session'),
      register: (body: RegisterRequest) => client.post<LoginResult>('/api/v1/auth/register', body),
      login: (body: LoginRequest) => client.post<LoginResult>('/api/v1/auth/login', body),
      /** Código do app autenticador ou de recuperação. */
      loginSecondFactor: (code: string) => client.post<LoginResult>('/api/v1/auth/login/2fa', { code }),
      reactivate: () => client.post<LoginResult>('/api/v1/auth/reactivate'),
      logout: () => client.post<void>('/api/v1/auth/logout'),
    },

    legal: {
      terms: () => client.get<TermsView>('/api/v1/legal/terms'),
    },

    me: {
      verifyEmail: (code: string) => client.post<SessionUserView>('/api/v1/me/verify-email', { code }),
      resendVerification: () => client.post<void>('/api/v1/me/verify-email/resend'),
      /** Aceita a versão vigente dos Termos (quando termsUpToDate = false). */
      acceptTerms: (version: string) => client.post<SessionUserView>('/api/v1/me/terms', { version }),

      // perfil e foto (RF2)
      profile: () => client.get<ProfileView>('/api/v1/me/profile'),
      updateProfile: (patch: ProfilePatch) => client.patch<ProfileView>('/api/v1/me/profile', patch),
      /** objectKey do POST /api/v1/media/uploads, depois do PUT no bucket. */
      setPhoto: (objectKey: string) => client.put<ProfileView>('/api/v1/me/photo', { objectKey }).then((r) => r.data),
      removePhoto: () => client.delJson<ProfileView>('/api/v1/me/photo'),

      // preferências (RF2, RF3)
      preferences: () => client.get<PreferencesView>('/api/v1/me/preferences'),
      updatePreferences: (patch: PreferencesPatch) => client.patch<PreferencesView>('/api/v1/me/preferences', patch),

      // consentimentos (RF3, ConsentController): uma chave por finalidade; desligar tem efeito imediato
      consents: () => client.get<ConsentList>('/api/v1/me/consents'),
      setConsent: (purpose: ConsentPurpose, granted: boolean) =>
        client.put<ConsentView>(`/api/v1/me/consents/${encodeURIComponent(purpose)}`, { granted }).then((r) => r.data),

      // senha, sessões e 2FA (RF27)
      changePassword: (body: PasswordChange) => client.post<{ otherSessionsClosed: number }>('/api/v1/me/password', body),
      sessions: () => client.get<SessionView[]>('/api/v1/me/sessions'),
      endSession: (id: string) => client.del(`/api/v1/me/sessions/${encodeURIComponent(id)}`),
      endOtherSessions: () => client.delJson<{ closed: number }>('/api/v1/me/sessions'),
      mfa: {
        status: () => client.get<MfaStatusView>('/api/v1/me/mfa'),
        /** Passo 1: senha (modo sudo); devolve a chave e a otpauth:// do QR code. */
        start: (body: SudoRequest) => client.post<MfaSetupView>('/api/v1/me/mfa/totp', body),
        /**
         * Passo 2: o código do app liga o 2FA e devolve os 10 códigos de recuperação. 409 = outra sessão ligou o 2FA
         * depois do passo 1 (o fator ativo não é sobrescrito).
         */
        confirm: (code: string) => client.post<RecoveryCodesView>('/api/v1/me/mfa/totp/confirm', { code }),
        regenerateCodes: (body: SudoRequest) => client.post<RecoveryCodesView>('/api/v1/me/mfa/recovery-codes', body),
        disable: (body: SudoRequest) => client.post<MfaStatusView>('/api/v1/me/mfa/disable', body),
      },

      // excluir conta (RF23): encerra todas as sessões, inclusive esta
      requestDeletion: (body: DeletionRequest) => client.post<DeletionView>('/api/v1/me/deletion', body),
    },

    media: {
      /** URL pré-assinada para enviar a foto direto ao bucket (RF29, RF2). */
      requestUpload: (body: UploadRequest) => client.post<UploadTicket>('/api/v1/media/uploads', body),
    },

    posts: {
      /** ⏳ Post Feed e Alert Feed (GET /api/v1/posts): ainda não existe no backend; o e2e simula. */
      feed: (params: FeedParams = {}, signal?: AbortSignal) => client.get<FeedPageView>('/api/v1/posts', { query: { ...params }, signal }),
      /** 404 = removido, rascunho de outra pessoa ou autor fora do ar (RF24). */
      get: (id: string) => client.get<PostDetailView>(post(id)),
      create: (draft: PostDraft) => client.post<PostDetailView>('/api/v1/posts', draft),
      /** Chave ausente mantém; null limpa (o JSON leva o null). */
      update: (id: string, patch: PostPatch) => client.patch<PostDetailView>(post(id), patch),
      archive: (id: string) => client.post<PostDetailView>(`${post(id)}/archive`),
      restore: (id: string) => client.post<PostDetailView>(`${post(id)}/restore`),
      remove: (id: string) => client.del(post(id)),

      // interações (RF26): PUT/DELETE idempotentes
      like: (id: string) => client.put<LikeStateView>(`${post(id)}/like`).then((r) => r.data),
      unlike: (id: string) => client.delJson<LikeStateView>(`${post(id)}/like`),
      save: (id: string) => client.put<SaveStateView>(`${post(id)}/save`).then((r) => r.data),
      unsave: (id: string) => client.delJson<SaveStateView>(`${post(id)}/save`),
      comments: (id: string, after = 0, limit = 20) =>
        client.get<CommentPageView>(`${post(id)}/comments`, { query: { after, limit } }),
      comment: (id: string, body: string) => client.post<CommentCreatedView>(`${post(id)}/comments`, { body }),
      /** 404 = outra exclusão chegou antes (o contador já desceu). */
      removeComment: (id: string, commentId: number) => client.del(`${post(id)}/comments/${seg(commentId)}`),
      share: (id: string, channel: ShareChannelCode) => client.post<ShareResultView>(`${post(id)}/shares`, { channel }),
    },

    users: {
      /** ⏳ Profile Feed (GET /api/v1/users): ainda não existe no backend; o e2e simula. */
      list: (params: ProfileListParams = {}, signal?: AbortSignal) =>
        client.get<ProfilePageView>('/api/v1/users', { query: { ...params }, signal }),
      /** Perfil público (RF25): 404 = conta fora do ar. */
      profile: (id: number | string) => client.get<PublicProfileView>(`/api/v1/users/${seg(id)}/profile`),
      /** Feed do autor (RF25), por cursor. */
      posts: (id: number | string, params: { cursor?: string; limit?: number } = {}) =>
        client.get<FeedPageView>(`/api/v1/users/${seg(id)}/posts`, { query: { ...params } }),
    },

    backgrounds: {
      /** Catálogo do estúdio de moldura (RF28, ETag + max-age 1 h: o navegador revalida). */
      catalog: () => client.get<FrameCatalog>('/api/v1/backgrounds/catalog'),
      recommendations: (category: CategoryCode, feed: 'POST' | 'ALERT' = 'POST', media: MediaKind = 'TEXT') =>
        client.get<FrameRecommendation[]>('/api/v1/backgrounds/recommendations', { query: { category, feed, media } }),
    },
  };
}

export type Api = ReturnType<typeof createApi>;

export function createApiWith(options: ClientOptions): Api {
  return createApi(createClient(options));
}
