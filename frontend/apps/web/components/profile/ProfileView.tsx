'use client';

import { isApiError, type PublicProfileView } from '@orange-social/api';
import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { CategoryBadge, CategoryDot } from '@/components/CategoryBadge';
import { Notice } from '@/components/Form';
import { IconCopy, IconMemberSince } from '@/components/icons';
import { Avatar } from '@/components/post/PostBits';
import { PostList } from '@/components/post/PostList';
import { plural } from '@/lib/format';
import { formatMonthYear } from '@/lib/post-format';
import { useProfilePosts, usePublicProfile } from '@/lib/post-queries';
import { feedHref } from '@/lib/feeds';
import { copyText } from '@/lib/share';

/**
 * Perfil público do autor (RF25): destino do toque na foto ou no nome. Minimização (LGPD Art. 6º, III): só nome,
 * categoria, foto, membro desde e nº de posts; depois, o feed do autor por cursor.
 */
export function ProfileView({ id }: { id: string }) {
  const profile = usePublicProfile(id);
  const name = profile.data?.name;
  useEffect(() => {
    if (name) document.title = `${name} · Orange Social`;
  }, [name]);

  if (profile.isPending) {
    return (
      <p role="status" className="text-muted">
        Carregando o perfil…
      </p>
    );
  }
  if (profile.isError) {
    if (isApiError(profile.error, 404)) {
      return (
        <div className="grid max-w-xl gap-4">
          <h1 className="text-3xl font-extrabold">Perfil não encontrado</h1>
          <p>A conta pode não existir mais ou estar fora do ar.</p>
          <p>
            <Link href={feedHref('PROFILE')} className="underline">
              Ver outros perfis
            </Link>
          </p>
        </div>
      );
    }
    return (
      <Notice tone="error" live>
        <p>Não foi possível carregar o perfil. {profile.error instanceof Error ? profile.error.message : ''}</p>
      </Notice>
    );
  }
  return <ProfileContent profile={profile.data} />;
}

function ProfileContent({ profile }: { profile: PublicProfileView }) {
  const uid = useId();
  const posts = useProfilePosts(String(profile.id), true);
  const [status, setStatus] = useState('');
  return (
    <div className="grid max-w-3xl gap-8">
      <header className="os-card grid gap-4 p-5" aria-labelledby={`${uid}-nome`} data-category={profile.category.code} data-testid="cabecalho-perfil">
        <div className="flex flex-wrap items-center gap-4">
          <span className="relative flex-none">
            <Avatar name={profile.name} url={profile.avatarUrl} size={88} />
            <span className="absolute -bottom-1 -right-1 rounded-full bg-bg p-0.5">
              <CategoryDot code={profile.category.code} size={26} />
            </span>
          </span>
          <div className="grid min-w-0 gap-1">
            <h1 id={`${uid}-nome`} className="break-words text-3xl font-extrabold">
              {profile.name}
            </h1>
            <p className="font-semibold">
              <span className="sr-only">Categoria: </span>
              <CategoryBadge code={profile.category.code} label={profile.category.label} size={18} />
            </p>
          </div>
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center gap-1.5">
            <dt className="inline-flex items-center gap-1 text-muted">
              <IconMemberSince size={16} />
              Membro desde
            </dt>
            <dd>{formatMonthYear(profile.memberSince)}</dd>
          </div>
          <div>
            <dt className="sr-only">Posts</dt>
            <dd data-testid="contagem-posts">{plural(profile.postCount, 'post', 'posts')}</dd>
          </div>
        </dl>
        {profile.shareUrl && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="os-btn os-btn-sm"
              onClick={async () => setStatus((await copyText(profile.shareUrl)) ? 'Link do perfil copiado.' : `Copie o link: ${profile.shareUrl}`)}
              data-testid="copiar-link-perfil"
            >
              <IconCopy size={16} />
              Copiar link do perfil
            </button>
            <span className="min-w-0 break-all text-sm text-muted">{profile.shareUrl}</span>
            <p role="status" className="w-full text-sm font-semibold">
              {status}
            </p>
          </div>
        )}
      </header>

      <section aria-labelledby={`${uid}-posts`} className="grid gap-4">
        <h2 id={`${uid}-posts`} className="text-xl font-bold">
          Posts de {profile.name}
        </h2>
        <PostList query={posts} label={`Posts de ${profile.name}`} testId="posts-perfil" empty={<p className="font-semibold">Nenhum post publicado ainda.</p>} />
      </section>
    </div>
  );
}
