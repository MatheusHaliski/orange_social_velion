import { expect, expectAccessibleInBothThemes, test } from './support/test';

test.describe('Background Studio (RF28)', () => {
  test.beforeEach(async ({ page, api }) => {
    api.login();
    await page.goto('/publicar');
    await expect(page.getByTestId('estudio')).toBeVisible();
  });

  test('4 abas, prévia ao vivo e uma arte por vez: escolher outra tira a anterior e avisa', async ({ page }) => {
    const estudio = page.getByTestId('estudio');
    await expect(estudio.getByRole('tablist', { name: 'Estúdio de moldura' }).getByRole('tab')).toHaveText(['Cor', 'Aura e Material', 'Layout e Estilo', 'Container']);
    await page.getByRole('textbox', { name: /^Título/ }).fill('Fim de tarde no Parque Barigui');
    await expect(page.getByTestId('previa').getByRole('article')).toContainText('Fim de tarde no Parque Barigui');
    await estudio.getByRole('button', { name: 'Ameixa', exact: true }).click();
    await expect(estudio.getByRole('button', { name: 'Ameixa', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await estudio.getByRole('button', { name: 'Pôr do sol', exact: true }).click();
    await expect(estudio.getByRole('button', { name: 'Ameixa', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('aviso-estudio')).toHaveText('Uma arte por vez: a cor Ameixa saiu.');
    await expect(page.getByTestId('previa').getByTestId('card-post-moldura')).toHaveAttribute('data-art', 'GRADIENT');
    // a categoria continua no container: filete, bolinha e rótulo
    await expect(page.getByTestId('previa').getByTestId('categoria')).toHaveText('Pessoa Física');
  });

  test('cartela sazonal: rascunho no modal com Aplicar e Cancelar; automática pela data', async ({ page }) => {
    const estudio = page.getByTestId('estudio');
    await estudio.getByRole('button', { name: 'Escolher cartela…', exact: true }).click();
    let modal = page.getByRole('dialog', { name: 'Cartela sazonal' });
    await modal.getByRole('radio', { name: /Natal e Réveillon/ }).check();
    await modal.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(modal).toBeHidden();
    await expect(estudio.getByTestId('cartela-atual')).toHaveText(/^Hoje: Outubro Rosa/);
    await expect(estudio.getByRole('button', { name: 'Escolher cartela…', exact: true })).toBeFocused();

    await estudio.getByRole('button', { name: 'Escolher cartela…', exact: true }).click();
    modal = page.getByRole('dialog', { name: 'Cartela sazonal' });
    await expect(modal.getByRole('radio', { name: /Automática pela data/ })).toBeChecked();
    await expect(modal.getByRole('radio', { name: /Black Friday/ })).toBeAttached();
    await expect(modal).toContainText('nunca entra no modo automático');
    await expectAccessibleInBothThemes(page, 'Modal da cartela');
    await modal.getByRole('button', { name: 'Aplicar', exact: true }).click();
    await expect(estudio.getByTestId('cartela-atual')).toHaveText(/Outubro Rosa.*automática pela data/);
    await expect(page.getByTestId('previa').getByTestId('card-post-moldura')).toHaveAttribute('data-art', 'SEASONAL');
  });

  test('aura com variação e mosaico, material, Aura Plus com pôster, Aura Hype na prévia "Em alta" e Metamorfose', async ({ page }) => {
    const estudio = page.getByTestId('estudio');
    const previa = page.getByTestId('previa');
    await estudio.getByRole('tab', { name: 'Aura e Material' }).click();
    await expect(estudio.getByTestId('recomendacoes')).toContainText('Eclipse + Vidro');
    await estudio.getByRole('button', { name: /^Varanda[\s,]/ }).click();
    await estudio.getByRole('button', { name: 'Mosaico', exact: true }).click();
    await estudio.getByRole('button', { name: 'Suave', exact: true }).click();
    await estudio.getByRole('button', { name: 'Cetim', exact: true }).click();
    await expect(previa.locator('[data-mosaic="true"]')).toBeAttached();
    await expect(previa.locator('[data-soft="true"]')).toBeAttached();
    await expect(previa.locator('[data-material="cetim"]')).toBeAttached();

    await estudio.getByRole('button', { name: /^Brasa[\s,]/ }).click();
    await expect(page.getByTestId('aviso-estudio')).toHaveText('Uma arte por vez: a aura Varanda saiu.');
    await expect(previa.getByTestId('card-post-moldura')).toHaveAttribute('data-art', 'AURA_PLUS');
    await expect(previa.getByTestId('aura-plus').locator('img')).toHaveAttribute('src', '/brand/auras/brasa-poster.webp');

    await estudio.getByRole('group', { name: 'Aura Hype' }).getByRole('button', { name: 'Brilho', exact: true }).click();
    await expect(previa.getByTestId('card-post-moldura')).not.toHaveAttribute('data-hype');
    await page.getByTestId('previa-em-alta').click();
    await expect(previa.getByTestId('card-post-moldura')).toHaveAttribute('data-hype', 'BRILHO');
    await expect(previa.getByTestId('tendencia')).toHaveText('em alta');

    await estudio.getByRole('group', { name: 'Metamorfose' }).getByRole('button', { name: 'Prisma', exact: true }).click();
    await expect(previa.locator('[data-metamorphose="PRISMA"]')).toBeAttached();
    await expect(estudio.getByTestId('arte-propria')).toContainText('ainda não está disponível');
  });

  test('Aura Plus respeita "Reduzir movimento": só o pôster, sem vídeo', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const estudio = page.getByTestId('estudio');
    await estudio.getByRole('tab', { name: 'Aura e Material' }).click();
    await estudio.getByRole('button', { name: /^Aurora[\s,]/ }).click();
    const plus = page.getByTestId('previa').getByTestId('aura-plus');
    await expect(plus.locator('img')).toHaveAttribute('src', '/brand/auras/aurora-poster.webp');
    await expect(plus.locator('video')).toHaveCount(0);
  });

  test('Aura Plus com movimento: o vídeo toca e volta ao pôster em até 5 s', async ({ page }) => {
    const estudio = page.getByTestId('estudio');
    await estudio.getByRole('tab', { name: 'Aura e Material' }).click();
    await estudio.getByRole('button', { name: /^Brasa[\s,]/ }).click();
    const plus = page.getByTestId('previa').getByTestId('aura-plus');
    await expect(plus.locator('video source').first()).toHaveAttribute('src', '/brand/auras/brasa-hq.mp4');
    // o Chromium do teste pode não ter o codec: tocando ou não, em 6 s ele precisa estar parado no pôster
    await expect(plus).toHaveAttribute('data-state', /^(playing|done)$/, { timeout: 4_000 });
    await expect(plus).toHaveAttribute('data-state', 'done', { timeout: 6_000 });
  });

  test('Pôster limpa a arte, o material e a Metamorfose, com uma frase explicando', async ({ page }) => {
    const estudio = page.getByTestId('estudio');
    await estudio.getByRole('tab', { name: 'Aura e Material' }).click();
    await estudio.getByRole('button', { name: /^Confete[\s,]/ }).click();
    await estudio.getByRole('button', { name: 'Metal', exact: true }).click();
    await estudio.getByRole('tab', { name: 'Layout e Estilo' }).click();
    await estudio.getByRole('button', { name: 'Pôster', exact: true }).click();
    await expect(page.getByTestId('aviso-estudio')).toHaveText('Pôster já traz arte própria: a aura Confete e o material Metal saíram.');
    await expect(page.getByTestId('previa').getByTestId('card-post-moldura')).toHaveAttribute('data-layout', 'POSTER');
    await expect(page.getByTestId('previa').locator('[data-material]')).toHaveCount(0);
    await estudio.getByRole('tab', { name: 'Aura e Material' }).click();
    await expect(estudio.getByText('já traz arte própria (o mosaico da marca)')).toBeVisible();
    await estudio.getByRole('button', { name: 'Voltar para Clássico', exact: true }).click();
    await expect(estudio.getByRole('button', { name: /^Confete[\s,]/ })).toHaveAttribute('aria-pressed', 'false');
  });

  test('contraste baixo avisa (role=alert) e sugere a tinta que passa; o servidor não recebe', async ({ page, api }) => {
    const estudio = page.getByTestId('estudio');
    await expect(estudio.getByTestId('contraste')).toContainText('passa no WCAG AA');
    await estudio.getByRole('tab', { name: 'Container' }).click();
    await estudio.getByRole('button', { name: 'Areia clara', exact: true }).click();
    await expect(estudio.getByTestId('contraste')).toContainText('16,0:1');
    await estudio.getByRole('button', { name: 'Clara', exact: true }).click();
    const alerta = estudio.getByTestId('contraste').getByRole('alert');
    await expect(alerta).toContainText('Texto com contraste 1,0:1: abaixo de 4,5:1');
    await expect(alerta).toContainText('Sugestão: tinta escura (16,0:1)');

    await page.getByRole('textbox', { name: /^Título/ }).fill('Fim de tarde no Parque Barigui');
    await page.getByRole('button', { name: 'Publicar', exact: true }).click();
    await expect(page.getByTestId('error-summary')).toContainText('Texto com contraste 1,0:1 sobre o container');
    expect(api.find('POST', /^\/api\/v1\/posts$/)).toHaveLength(0);

    await alerta.getByRole('button', { name: 'Usar a tinta sugerida', exact: true }).click();
    await expect(estudio.getByTestId('contraste').getByRole('status')).toContainText('16,0:1');
    await page.getByRole('button', { name: 'Publicar', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Fim de tarde no Parque Barigui' })).toBeVisible();
    expect(api.last('POST', /^\/api\/v1\/posts$/)?.body).toMatchObject({ background: { v: 1, container: { color: '#F5EDE3' } } });
  });

  test('sem violações graves em cada aba', async ({ page }) => {
    const estudio = page.getByTestId('estudio');
    for (const aba of ['Aura e Material', 'Layout e Estilo', 'Container']) {
      await estudio.getByRole('tab', { name: aba }).click();
      await expectAccessibleInBothThemes(page, `Estúdio · ${aba}`);
    }
  });
});
