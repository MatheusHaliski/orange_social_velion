import { FOTO_FIXTURE, problem } from './support/mock-api';
import { expect, expectAccessibleInBothThemes, test } from './support/test';

const BARIGUI = '/posts/0199a1b2-c3d4-7e5f-8a9b-000000000009';

test.describe('Publicar e editar (RF29) com o Background Studio (RF28)', () => {
  test('post com foto (URL pré-assinada), classificação, local e moldura', async ({ page, api }) => {
    api.login();
    await page.goto('/');
    await page.getByTestId('link-publicar').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Publicar' })).toBeVisible();
    await page.getByRole('textbox', { name: /^Título/ }).fill('Pedalada até o Parque Tanguá');
    await page.getByRole('textbox', { name: /^Subtítulo/ }).fill('Ida pela ciclovia, volta pelo São Lourenço.');
    await page.getByRole('textbox', { name: /^Texto/ }).fill('Vinte e dois quilômetros no total.');
    await page.getByLabel('Escolher foto').setInputFiles(FOTO_FIXTURE);
    await expect(page.getByText('Foto enviada.')).toBeVisible();
    expect(api.account.bucketPuts[0]).toMatchObject({ method: 'PUT' });
    await expect(page.getByTestId('previa-foto')).toBeVisible();
    await page.getByRole('radio', { name: /^12\+/ }).check();
    await page.getByRole('textbox', { name: /^Cidade/ }).fill('Curitiba');

    const estudio = page.getByTestId('estudio');
    await estudio.getByRole('tab', { name: 'Aura e Material' }).click();
    await estudio.getByRole('button', { name: /^Maré[\s,]/ }).click();
    await estudio.getByRole('button', { name: 'Vidro', exact: true }).click();
    const previa = page.getByTestId('previa');
    await expect(previa.getByTestId('card-post-moldura')).toHaveAttribute('data-art', 'AURA');
    await expect(previa.getByRole('heading', { name: 'Pedalada até o Parque Tanguá' })).toBeVisible();
    await expect(previa.getByTestId('tipo-midia')).toHaveText(/Imagem/);
    await expect(previa.getByTestId('classificacao')).toHaveText(/12\+/);

    await page.getByTestId('enviar-post').click();
    await expect(page).toHaveURL(/\/posts\/0199a1b2-c3d4-7e5f-8a9b-000000000500$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Pedalada até o Parque Tanguá' })).toBeVisible();
    const post = api.last('POST', /^\/api\/v1\/posts$/)!;
    expect(post.headers['x-xsrf-token']).toBe(api.csrfToken);
    expect(post.body).toEqual({
      feed: 'POST',
      mediaType: 'IMAGE',
      title: 'Pedalada até o Parque Tanguá',
      subtitle: 'Ida pela ciclovia, volta pelo São Lourenço.',
      body: 'Vinte e dois quilômetros no total.',
      ageRating: 'AGE_12',
      country: 'BR',
      city: 'Curitiba',
      background: { v: 1, aura: { presetId: 'mare', variantId: 'ORIGINAL', format: 'IMAGEM_UNICA' }, materialId: 'vidro' },
      mediaObjectKey: 'uploads/42/01991.png',
    });
    await expect(page.getByTestId('post-moldura')).toHaveAttribute('data-art', 'AURA');
    await expect(page.locator('[data-material="vidro"]')).toBeAttached();
  });

  test('erros locais e o 422 aparecem por campo, com o resumo focado', async ({ page, api }) => {
    api.login();
    await page.goto('/publicar');
    await page.getByTestId('enviar-post').click();
    const resumo = page.getByTestId('error-summary');
    await expect(resumo).toBeFocused();
    await expect(resumo).toContainText('Dê um título ao post.');
    expect(api.find('POST', /^\/api\/v1\/posts$/)).toHaveLength(0);

    await page.getByRole('textbox', { name: /^Título/ }).fill('Texto de teste');
    api.on('POST', /^\/api\/v1\/posts$/, problem(422, 'Revise o post', { errors: ['Menores de 18 anos não publicam conteúdo 18+ ou sensível.', 'Algo que a tela não conhece.'] }));
    await page.getByTestId('enviar-post').click();
    await expect(resumo).toContainText('Menores de 18 anos não publicam conteúdo 18+ ou sensível.');
    await expect(resumo).toContainText('Algo que a tela não conhece.');
    await resumo.getByRole('link', { name: 'Menores de 18 anos não publicam conteúdo 18+ ou sensível.' }).click();
    await expect(page.locator('#post-ageRating')).toBeAttached();
  });

  test('conta em verificação (Instituição) e conta pendente não publicam e veem o porquê', async ({ page, api }) => {
    api.login({ categoryCode: 'VERMELHO', categoryVerification: 'PENDING' });
    await page.goto('/publicar');
    await expect(page.getByText('ainda está em verificação')).toBeVisible();
    api.login({ accountStatus: 'PENDING_VERIFICATION', emailVerified: false });
    await page.reload();
    await expect(page.getByRole('link', { name: 'Confirmar e-mail' })).toBeVisible();
  });

  test('editar: a foto não muda e a moldura só vai quando muda', async ({ page, api }) => {
    api.login();
    await page.goto(`${BARIGUI}/editar`);
    await expect(page.getByRole('heading', { level: 1, name: 'Editar post' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /^Título/ })).toHaveValue('Fim de tarde no Parque Barigui');
    await expect(page.getByText('A foto não muda na edição')).toBeVisible();
    await page.getByRole('textbox', { name: /^Título/ }).fill('Fim de tarde no Barigui (com capivaras)');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Fim de tarde no Barigui (com capivaras)' })).toBeVisible();
    expect(api.last('PATCH', /\/posts\//)!.body).toEqual({ title: 'Fim de tarde no Barigui (com capivaras)' });

    await page.goto(`${BARIGUI}/editar`);
    const estudio = page.getByTestId('estudio');
    await estudio.getByRole('button', { name: 'Sem arte', exact: true }).click();
    await estudio.getByRole('tab', { name: 'Aura e Material' }).click();
    await estudio.getByRole('button', { name: 'Nenhum', exact: true }).click();
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByTestId('post-moldura')).toHaveCount(0);
    expect((api.last('PATCH', /\/posts\//)!.body as Record<string, unknown>).background).toBeNull();
  });

  test('sem violações graves no formulário com o estúdio', async ({ page, api }) => {
    api.login();
    await page.goto('/publicar');
    await expect(page.getByTestId('estudio')).toBeVisible();
    await expectAccessibleInBothThemes(page, 'Publicar');
  });
});
