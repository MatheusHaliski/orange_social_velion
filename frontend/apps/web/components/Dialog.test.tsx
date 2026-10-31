import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Dialog } from './Dialog';

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} role="alertdialog" labelledBy="t" describedBy="d">
        <h2 id="t">Excluir?</h2>
        <p id="d">Não dá para desfazer.</p>
        <button type="button" onClick={() => setOpen(false)}>
          Cancelar
        </button>
        <button type="button">Excluir</button>
      </Dialog>
    </>
  );
}

describe('Dialog', () => {
  it('alertdialog modal: foco dentro, Tab gira, Esc fecha e devolve o foco', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Abrir' });
    await user.click(opener);
    const dialog = screen.getByRole('alertdialog', { name: 'Excluir?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('Não dá para desfazer.');
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Excluir' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Excluir' })).toHaveFocus();
    expect(opener.closest('div')).toHaveAttribute('inert');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(opener.closest('div')).not.toHaveAttribute('inert');
  });
});
