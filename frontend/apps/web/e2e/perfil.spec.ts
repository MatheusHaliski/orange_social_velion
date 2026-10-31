import { expect, expectAccessibleInBothThemes, test } from './support/test';

test.describe('Perfil público do autor (RF25)', () => {
  test('toque no nome do autor no card leva ao perfil: cabeçalho mínimo, membro desde, posts e link', async ({ page, api, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/?feed=posts');
    const card = page.getByRole('article', { name: 'Troquei o carro pela bike por 30 dias. O resultado me surpreendeu' });
    await card.getByRole('link', { name: 'Ver perfil de Ana Ribeiro' }).click();
    await expect(page).toHaveURL(/\/u\/42$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Ana Ribeiro' })).toBeVisible();
    await expect(page).toHaveTitle('Ana Ribeiro · Orange Social');
    const cabecalho = page.getByTestId('cabecalho-perfil');
    await expect(cabecalho).toContainText('Pessoa Física');
    await expect(cabecalho.locator('svg[data-glyph="diamond"]').first()).toBeVisible();
    await expect(cabecalho).toContainText('março de 2025');
    await expect(page.getByTestId('contagem-posts')).toHaveText('2 posts');
    // minimização: nada de cidade, e-mail ou bio no perfil público
    await expect(cabecalho).not.toContainText('Curitiba');
    await expect(page.getByTestId('posts-perfil').getByRole('article')).toHaveCount(2);
    await page.getByTestId('copiar-link-perfil').click();
    await expect(page.getByText('Link do perfil copiado.')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('http://localhost:3000/u/42');
    expect(api.find('GET', /\/users\/42\/posts$/)).toHaveLength(1);
    await expectAccessibleInBothThemes(page, 'Perfil público');
  });

  test('post arquivado aparece só para o próprio autor; inexistente dá 404', async ({ page, api }) => {
    await page.goto('/u/205');
    await expect(page.getByTestId('posts-perfil')).toHaveCount(0);
    await expect(page.getByText('Nenhum post publicado ainda.')).toBeVisible();
    api.login({ id: 205, name: 'Bruno Costa', handle: 'brunocosta' });
    await page.reload();
    await expect(page.getByTestId('posts-perfil').getByRole('article', { name: 'Fotos antigas do centro de Curitiba' })).toContainText('Arquivado');
    await page.goto('/u/999');
    await expect(page.getByRole('heading', { level: 1, name: 'Perfil não encontrado' })).toBeVisible();
  });
});
