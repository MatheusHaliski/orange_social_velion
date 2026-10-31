import type { ReactNode } from 'react';

/**
 * Feeds e perfil do autor: daqui o toque no card abre o post em modal por cima da lista (slot @modal, RF24).
 * De outras telas (publicar, editar, configurações) o mesmo endereço abre a página do post.
 */
export default function FeedsLayout({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
