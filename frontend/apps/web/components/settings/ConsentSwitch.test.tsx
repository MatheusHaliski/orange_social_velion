import type { ConsentView } from '@orange-social/api';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConsentSwitch, lockedText } from './ConsentSwitch';

const base: ConsentView = {
  purpose: 'LOCATION_TRACKING',
  label: 'Salvar minha localização',
  description: 'Usada no “perto de mim” e nos alertas oficiais da região.',
  legalBasis: 'Art. 7º, I (consentimento)',
  sensitive: false,
  granted: false,
  updatedAt: null,
  lockedForMinor: false,
};

function renderSwitch(patch: Partial<ConsentView> = {}, onToggle = vi.fn()) {
  render(
    <ul>
      <ConsentSwitch consent={{ ...base, ...patch }} onToggle={onToggle} />
    </ul>,
  );
  return onToggle;
}

describe('ConsentSwitch', () => {
  it('interruptor desligado, com nome, finalidade e base legal na descrição', async () => {
    const onToggle = renderSwitch();
    const sw = screen.getByRole('switch', { name: 'Salvar minha localização' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(sw).toHaveAccessibleDescription(/perto de mim.*Base legal:\s?Art\. 7º, I \(consentimento\)/);
    expect(screen.getByText('Desligado')).toBeInTheDocument();
    await userEvent.click(sw);
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('ligado: um toque revoga', async () => {
    const onToggle = renderSwitch({ granted: true, updatedAt: '2026-10-20T15:00:00Z' });
    const sw = screen.getByRole('switch', { name: 'Salvar minha localização' });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Ligado')).toBeInTheDocument();
    expect(screen.getByText('Alterado em 20 de outubro de 2026.')).toBeInTheDocument();
    await userEvent.click(sw);
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it('sensível mostra o selo "Dado sensível" e trava até os 18', () => {
    renderSwitch({ purpose: 'SENSITIVE_PROFILE_DATA', label: 'Orientação sexual no perfil', sensitive: true, lockedForMinor: true });
    expect(screen.getByText('Dado sensível')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toHaveAccessibleDescription(/Disponível a partir dos 18 anos/);
  });

  it('travado para menor: desabilitado, com a idade pela flag sensitive', async () => {
    const onToggle = renderSwitch({ lockedForMinor: true });
    const sw = screen.getByRole('switch');
    expect(sw).toBeDisabled();
    expect(sw).toHaveAccessibleDescription(/Disponível a partir dos 16 anos/);
    await userEvent.click(sw);
    expect(onToggle).not.toHaveBeenCalled();
    expect(lockedText({ sensitive: true })).toBe('Disponível a partir dos 18 anos');
  });

  it('enquanto salva fica ocupado e ignora outro toque', async () => {
    const onToggle = vi.fn();
    render(
      <ul>
        <ConsentSwitch consent={base} onToggle={onToggle} busy />
      </ul>,
    );
    const sw = screen.getByRole('switch');
    expect(sw).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(sw);
    expect(onToggle).not.toHaveBeenCalled();
  });
});
