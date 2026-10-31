'use client';

import { isApiError, type FrameCatalog, type PostCardView, type PostDetailView, type SessionUserView } from '@orange-social/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { ErrorSummary, Field, Notice, useFocusOnChange } from '@/components/Form';
import { IconStudio } from '@/components/icons';
import { FrameStudio } from '@/components/studio/FrameStudio';
import { api } from '@/lib/api';
import { mapPostErrors } from '@/lib/field-errors';
import { fromConfig, toConfig, validateFrame, type FrameState } from '@/lib/frame';
import {
  AGE_RATINGS,
  buildDraft,
  buildPatch,
  emptyValues,
  MAX_BODY,
  MAX_CITY,
  MAX_SUBTITLE,
  MAX_TITLE,
  valuesFromPost,
  type FormErrors,
  type PostFormValues,
} from '@/lib/post-form';
import { openPostPage } from '@/lib/post-format';
import { postKey, useFrameCatalog, usePost } from '@/lib/post-queries';
import { useRequireSession } from '@/lib/queries';
import { loginHref } from '@/lib/safe-redirect';
import { PhotoPicker, type PhotoState } from './PhotoPicker';

/** Publicar (/publicar) e editar (/posts/[id]/editar) um post (RF29) com o Background Studio (RF28). */
export function PublishView({ editId }: { editId?: string }) {
  const session = useRequireSession(editId ? `/posts/${editId}/editar` : '/publicar');
  const catalog = useFrameCatalog();
  const post = usePost(editId ?? '', !!editId);
  const user = session.data;

  if (session.isPending || !user || catalog.isPending || (editId && post.isPending)) {
    return (
      <p role="status" className="text-muted">
        Carregando…
      </p>
    );
  }
  if (catalog.isError) {
    return (
      <Notice tone="error" live>
        <p>Não foi possível abrir o formulário agora. Tente de novo em instantes.</p>
      </Notice>
    );
  }
  if (editId) {
    if (post.isError || !post.data) {
      return (
        <div className="grid max-w-xl gap-4">
          <h1 className="text-3xl font-extrabold">Este post não está mais disponível</h1>
          <p>
            <Link href="/" className="underline">
              Voltar para os feeds
            </Link>
          </p>
        </div>
      );
    }
    if (!post.data.viewer.isAuthor) {
      return (
        <div className="grid max-w-xl gap-4">
          <h1 className="text-3xl font-extrabold">Só quem publicou edita o post</h1>
          <p>
            <a href={`/posts/${editId}`} className="underline">
              Ver o post
            </a>
          </p>
        </div>
      );
    }
  }
  return <PostEditor key={editId ?? 'novo'} user={user} catalog={catalog.data} post={editId ? post.data : undefined} />;
}

/** Quem não pode publicar ainda: conta pendente ou instituição/banco sem selo (RF29, TAXONOMIA §1.4). */
function publishBlocker(user: SessionUserView): ReactNode | null {
  if (user.accountStatus !== 'ACTIVE') {
    return (
      <p>
        Sua conta precisa estar ativa para publicar.{' '}
        <Link href="/confirmar-email" className="font-semibold underline">
          Confirmar e-mail
        </Link>
      </p>
    );
  }
  if (user.category.code === 'VERMELHO' && user.categoryVerification !== 'VERIFIED') {
    return <p>Sua conta de {user.category.label} ainda está em verificação: você já lê e interage, e publica depois do selo.</p>;
  }
  return null;
}

function PostEditor({ user, catalog, post }: { user: SessionUserView; catalog: FrameCatalog; post?: PostDetailView }) {
  const uid = useId();
  const router = useRouter();
  const qc = useQueryClient();
  const [values, setValues] = useState<PostFormValues>(() => (post ? valuesFromPost(post) : emptyValues()));
  const [photo, setPhoto] = useState<PhotoState>({ key: null, currentUrl: post?.mediaUrl ?? null, removed: false });
  const [photoBusy, setPhotoBusy] = useState(false);
  const initialFrame = useMemo(() => fromConfig(post?.background?.config ?? null), [post]);
  const [frame, setFrame] = useState<FrameState>(initialFrame);
  const [errors, setErrors] = useState<FormErrors>({});
  const [general, setGeneral] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const summaryRef = useFocusOnChange<HTMLDivElement>(attempt);
  const set = <K extends keyof PostFormValues>(k: K, v: PostFormValues[K]) => setValues((old) => ({ ...old, [k]: v }));
  const here = post ? `/posts/${post.id}/editar` : '/publicar';

  const save = useMutation({
    mutationFn: async () => {
      const frameConfig = toConfig(frame);
      if (post) {
        const changed = JSON.stringify(frameConfig) !== JSON.stringify(toConfig(initialFrame));
        return api.posts.update(post.id, buildPatch(post, values, frameConfig, changed).patch);
      }
      return api.posts.create(buildDraft(values, { key: photo.key }, frameConfig).draft);
    },
    onSuccess: (view) => {
      qc.setQueryData(postKey(view.id), view);
      void qc.invalidateQueries({ queryKey: ['posts'] });
      void qc.invalidateQueries({ queryKey: ['perfil'] });
      openPostPage(`/posts/${view.id}`);
    },
    onError: (e) => {
      if (isApiError(e, 401)) {
        router.push(loginHref(here));
        return;
      }
      if (isApiError(e, 422)) {
        const mapped = mapPostErrors(e.errors.length ? e.errors : [e.detail], new Set(Object.keys(FIELD_IDS)));
        setErrors(mapped.fields);
        setGeneral(mapped.general);
      } else {
        setErrors({});
        setGeneral([isApiError(e) ? e.detail : 'Não foi possível publicar agora. Tente de novo.']);
      }
      setAttempt((n) => n + 1);
    },
  });

  function submit() {
    if (photoBusy) {
      setGeneral(['Espere a foto terminar de enviar.']);
      setAttempt((n) => n + 1);
      return;
    }
    const { errors: local } = buildDraft(values, { key: photo.key }, null);
    const frameErrors = validateFrame(frame, catalog, 'POST');
    const all: FormErrors = { ...local };
    if (frameErrors.length) all.background = frameErrors;
    if (Object.keys(all).length) {
      setErrors(all);
      setGeneral([]);
      setAttempt((n) => n + 1);
      return;
    }
    setErrors({});
    setGeneral([]);
    save.mutate();
  }

  const summary = [
    ...general.map((message) => ({ message })),
    ...Object.entries(errors).flatMap(([k, msgs]) => msgs.map((message) => ({ message, fieldId: FIELD_IDS[k] }))),
  ];
  const hasPhoto = !!photo.key || (!!photo.currentUrl && !photo.removed);
  const rating = AGE_RATINGS.find((r) => r.code === values.ageRating) ?? AGE_RATINGS[0]!;
  const preview: PostCardView = {
    id: post?.id ?? 'previa',
    feed: 'POST',
    mediaType: hasPhoto ? 'IMAGE' : 'TEXT',
    title: values.title.trim() || 'O título aparece aqui',
    subtitle: values.subtitle.trim() || null,
    mediaUrl: photo.localUrl ?? (photo.removed ? null : photo.currentUrl),
    durationSeconds: null,
    ageRating: rating.code,
    ageRatingLabel: rating.label,
    status: 'PUBLISHED',
    publishedAt: post?.publishedAt ?? new Date().toISOString(),
    author: { id: user.id, name: user.name, category: user.category, avatarUrl: null, profilePath: null, available: true },
    counts: post?.counts ?? { likes: 0, comments: 0, shares: 0, views: 0 },
    viewer: { liked: false, saved: false, isAuthor: true },
    detailPath: '',
    background: null,
  };
  const title = post ? 'Editar post' : 'Publicar';
  const blocker = post ? null : publishBlocker(user);

  if (blocker) {
    return (
      <div className="grid max-w-2xl gap-4">
        <h1 className="text-3xl font-extrabold">{title}</h1>
        <Notice>{blocker}</Notice>
      </div>
    );
  }

  return (
    <form
      aria-labelledby={`${uid}-titulo`}
      className="grid gap-8"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-2">
        <h1 id={`${uid}-titulo`} className="text-3xl font-extrabold">
          {title}
        </h1>
        <p className="text-muted">
          No feed aparecem o título e o subtítulo; o texto completo fica no post. Vídeo e áudio ainda não (falta o processamento no servidor).
        </p>
      </div>
      <ErrorSummary ref={summaryRef} items={summary} />

      <Section title="Conteúdo">
        <Field id={FIELD_IDS.title!} label="Título" required hint={`Até ${MAX_TITLE} caracteres. É o que aparece no card (5 a 12 palavras funcionam bem).`} errors={errors.title}>
          {(aria) => <input {...aria} className="os-input" maxLength={MAX_TITLE} value={values.title} onChange={(e) => set('title', e.target.value)} />}
        </Field>
        <Field id={FIELD_IDS.subtitle!} label="Subtítulo" hint={`Opcional, até ${MAX_SUBTITLE} caracteres; o card mostra 2 linhas.`} errors={errors.subtitle}>
          {(aria) => <input {...aria} className="os-input" maxLength={MAX_SUBTITLE} value={values.subtitle} onChange={(e) => set('subtitle', e.target.value)} />}
        </Field>
        <Field
          id={FIELD_IDS.body!}
          label="Texto"
          hint={`Opcional, até ${MAX_BODY.toLocaleString('pt-BR')} caracteres (${values.body.length.toLocaleString('pt-BR')} usados). Só aparece no post aberto.`}
          errors={errors.body}
        >
          {(aria) => <textarea {...aria} className="os-input min-h-32" maxLength={MAX_BODY} value={values.body} onChange={(e) => set('body', e.target.value)} />}
        </Field>
        {post ? (
          <p className="text-sm text-muted">A foto não muda na edição: para outra foto, apague e publique de novo.</p>
        ) : (
          <PhotoPicker value={photo} onChange={setPhoto} required={false} errors={errors.photo} onBusy={setPhotoBusy} />
        )}
      </Section>

      <Section title="Classificação e local">
        <fieldset className="grid gap-2" id={FIELD_IDS.ageRating} aria-describedby={errors.ageRating ? 'post-ageRating-erro' : undefined}>
          <legend className="font-semibold">Classificação indicativa</legend>
          <div className="flex flex-wrap gap-2">
            {AGE_RATINGS.map((r) => (
              <label key={r.code} className="relative">
                <input
                  type="radio"
                  name="post-ageRating"
                  value={r.code}
                  className="os-visually-hidden-input"
                  checked={values.ageRating === r.code}
                  onChange={() => set('ageRating', r.code)}
                />
                <span className="os-pill">
                  <span className="os-rating" data-rating={r.code} aria-hidden="true">
                    {r.label}
                  </span>
                  <span className="sr-only">{r.label}: </span>
                  <span className="font-normal">{r.hint}</span>
                </span>
              </label>
            ))}
          </div>
          {user.minor && <p className="text-sm text-muted">Menores de 18 anos não publicam conteúdo 18+ ou sensível.</p>}
          {errors.ageRating && (
            <p id="post-ageRating-erro" className="text-sm font-semibold text-error">
              {errors.ageRating.join(' ')}
            </p>
          )}
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
          <Field id={FIELD_IDS.country!} label="País" hint="Duas letras, ex.: BR." errors={errors.country}>
            {(aria) => <input {...aria} className="os-input uppercase" maxLength={2} value={values.country} onChange={(e) => set('country', e.target.value)} />}
          </Field>
          <Field id={FIELD_IDS.city!} label="Cidade" hint="Opcional. Ajuda nos filtros País e Cidade." errors={errors.city}>
            {(aria) => <input {...aria} className="os-input" maxLength={MAX_CITY} value={values.city} onChange={(e) => set('city', e.target.value)} />}
          </Field>
        </div>
      </Section>

      <Section
        id={FIELD_IDS.background}
        title={
          <span className="inline-flex items-center gap-2">
            <IconStudio size={20} />
            Moldura do post (Background Studio)
          </span>
        }
      >
        <p className="text-sm text-muted">
          Opcional. A arte fica só na faixa em volta do card; autor, categoria e texto ficam no container opaco, com contraste conferido.
        </p>
        <FrameStudio
          catalog={catalog}
          state={frame}
          onChange={setFrame}
          disabled={false}
          category={user.category.code}
          media={hasPhoto ? 'IMAGE' : 'TEXT'}
          minor={user.minor}
          preview={preview}
          errors={errors.background}
        />
      </Section>

      <div className="flex flex-wrap gap-2 border-t border-line pt-6">
        <button type="submit" className="os-btn os-btn-primary" disabled={save.isPending} data-testid="enviar-post">
          {save.isPending ? 'Salvando…' : post ? 'Salvar alterações' : 'Publicar'}
        </button>
        {post ? (
          <a href={`/posts/${post.id}`} className="os-btn">
            Cancelar
          </a>
        ) : (
          <Link href="/" className="os-btn">
            Cancelar
          </Link>
        )}
      </div>
    </form>
  );
}

/** Id de cada campo na tela, para o resumo de erros levar até ele. */
const FIELD_IDS: Record<string, string> = {
  title: 'post-title',
  subtitle: 'post-subtitle',
  body: 'post-body',
  photo: 'post-photo',
  ageRating: 'post-ageRating',
  country: 'post-country',
  city: 'post-city',
  background: 'post-background',
};

function Section({ title, children, id }: { title: ReactNode; children: ReactNode; id?: string }) {
  const hid = useId();
  return (
    <section aria-labelledby={hid} id={id} className="grid gap-4 border-t border-line pt-6">
      <h2 id={hid} className="text-xl font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}
