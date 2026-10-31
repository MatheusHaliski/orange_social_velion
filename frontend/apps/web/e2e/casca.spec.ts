import { expect, expectAccessibleInBothThemes, test } from './support/test';

test.describe('Casca do app', () => {
  test('lang, pular para o conteúdo e cabeçalhos de segurança', async ({ page }) => {
    const res = await page.goto('/termos');
    expect(res?.headers()['x-content-type-options']).toBe('nosniff');
    expect(res?.headers()['referrer-policy']).toBe('no-referrer');
    expect(res?.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('#conteudo')).toBeFocused();
  });

  test('tema: alterna, persiste só a preferência e respeita o sistema', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/termos');
    const botao = page.getByRole('button', { name: 'Tema escuro' });
    await expect(botao).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(23, 18, 13)');
    await botao.click();
    await expect(botao).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    const storage = await page.evaluate(() => Object.keys(localStorage));
    expect(storage).toEqual(['os:tema']);
  });

  test('cabeçalho com o mark oficial e a assinatura "orange."; itens quebram linha com fonte larga em 320 px', async ({ page, api }) => {
    api.login();
    await page.goto('/');
    await expect(page.getByTestId('logo')).toHaveAccessibleName(/Orange Social, início/);
    await expect(page.getByTestId('logo').locator('img')).toHaveAttribute('src', '/brand/orange-social-mark.svg');
    await page.setViewportSize({ width: 320, height: 720 });
    // fonte larga e texto em 150%: nada pode empurrar a página para os lados
    await page.addStyleTag({ content: 'html, body, button, input, select, textarea { font-family: "DejaVu Sans", Verdana, sans-serif !important; }' });
    await page.evaluate(() => (document.documentElement.style.fontSize = '150%'));
    for (const path of ['/', '/?feed=alertas', '/?feed=perfis', '/configuracoes/exibicao', '/publicar', `/posts/0199a1b2-c3d4-7e5f-8a9b-000000000001`]) {
      await page.goto(path);
      await page.addStyleTag({ content: 'html, body, button, input, select, textarea { font-family: "DejaVu Sans", Verdana, sans-serif !important; }' });
      await page.evaluate(() => (document.documentElement.style.fontSize = '150%'));
      await page.waitForLoadState('networkidle');
      // mede depois que as imagens e o tamanho do texto assentam
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), { message: `rolagem horizontal em ${path}` })
        .toBeLessThanOrEqual(0);
    }
  });

  test('Termos de Uso vêm do Markdown do repositório', async ({ page }) => {
    await page.goto('/termos');
    await expect(page.getByRole('heading', { level: 1, name: /Termos de Uso/ })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: '1. Quem somos' })).toBeVisible();
    await expect(page.getByRole('table').first()).toBeVisible();
    await expectAccessibleInBothThemes(page, 'Termos');
  });
});
