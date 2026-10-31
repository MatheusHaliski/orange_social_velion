// Capturas das telas principais nos dois temas, no computador e no celular. Só roda com SCREENSHOTS_DIR definido:
//   SCREENSHOTS_DIR=/tmp/telas npm run e2e -- screenshots
import path from 'node:path';
import type { Page } from '@playwright/test';
import type { MockApi } from './support/mock-api';
import { expect, test } from './support/test';

const dir = process.env.SCREENSHOTS_DIR;
const TEMAS = ['claro', 'escuro'] as const;
const TELAS_DISP = { computador: { width: 1280, height: 900 }, celular: { width: 390, height: 844 } } as const;

interface Tela {
  nome: string;
  path: string;
  logado?: boolean;
  antes?: (api: MockApi) => void;
  pronto: (page: Page) => Promise<void>;
}

const TELAS: Tela[] = [
  { nome: 'feed-posts', path: '/?feed=posts', pronto: (p) => expect(p.getByTestId('lista-posts')).toBeVisible() },
  { nome: 'feed-alertas', path: '/?feed=alertas', pronto: (p) => expect(p.getByTestId('lista-alertas')).toBeVisible() },
  { nome: 'feed-perfis', path: '/?feed=perfis', pronto: (p) => expect(p.getByTestId('lista-perfis')).toBeVisible() },
  { nome: 'feed-audio', path: '/?feed=audio', pronto: (p) => expect(p.getByTestId('audio-em-breve')).toBeVisible() },
  {
    nome: 'feed-fundo-areia',
    path: '/?feed=posts',
    logado: true,
    antes: (api) => (api.account.preferences.appBackground = 'MOSAIC_SAND'),
    pronto: async (p) => {
      await expect(p.getByTestId('lista-posts')).toBeVisible();
      await expect(p.locator('html')).toHaveAttribute('data-app-bg', 'MOSAIC_SAND');
    },
  },
  { nome: 'post-pagina', path: '/posts/0199a1b2-c3d4-7e5f-8a9b-000000000009', logado: true, pronto: (p) => expect(p.getByTestId('comentarios')).toBeVisible() },
  { nome: 'alerta-pagina', path: '/posts/0199a1b2-c3d4-7e5f-8a9b-000000000007', pronto: (p) => expect(p.getByTestId('dados-alerta')).toBeVisible() },
  { nome: 'perfil-autor', path: '/u/42', pronto: (p) => expect(p.getByTestId('posts-perfil')).toBeVisible() },
  { nome: 'entrar', path: '/entrar', pronto: (p) => expect(p.getByRole('heading', { name: 'Entrar' })).toBeVisible() },
  { nome: 'cadastro', path: '/cadastro', pronto: (p) => expect(p.getByText('Versão 2026-10-25.1.')).toBeVisible() },
  { nome: 'publicar', path: '/publicar', logado: true, pronto: (p) => expect(p.getByTestId('estudio')).toBeVisible() },
  { nome: 'config-perfil', path: '/configuracoes/perfil', logado: true, pronto: (p) => expect(p.getByLabel('Bio')).toBeVisible() },
  { nome: 'config-exibicao', path: '/configuracoes/exibicao', logado: true, pronto: (p) => expect(p.getByTestId('fundos')).toBeVisible() },
  { nome: 'config-privacidade', path: '/configuracoes/privacidade', logado: true, pronto: (p) => expect(p.getByRole('switch').first()).toBeVisible() },
  { nome: 'config-seguranca', path: '/configuracoes/seguranca', logado: true, pronto: (p) => expect(p.getByTestId('lista-sessoes')).toBeVisible() },
  { nome: 'config-conta', path: '/configuracoes/conta', logado: true, pronto: (p) => expect(p.getByRole('button', { name: 'Excluir minha conta…' })).toBeVisible() },
];

async function preparar(page: Page, tema: (typeof TEMAS)[number], tamanho: { width: number; height: number }) {
  await page.setViewportSize(tamanho);
  await page.emulateMedia({ colorScheme: tema === 'claro' ? 'light' : 'dark', reducedMotion: 'reduce' });
}

test.describe('capturas de tela', () => {
  test.skip(!dir, 'defina SCREENSHOTS_DIR para gerar as capturas');

  for (const tela of TELAS) {
    for (const [disp, tamanho] of Object.entries(TELAS_DISP)) {
      for (const tema of TEMAS) {
        test(`${tela.nome} · ${disp} · ${tema}`, async ({ page, api }) => {
          if (tela.logado) api.login();
          tela.antes?.(api);
          await preparar(page, tema, tamanho);
          await page.goto(tela.path);
          await tela.pronto(page);
          if (tela.nome === 'cadastro') await page.getByRole('radio', { name: /^Instituição/ }).check();
          // carrega as fotos com loading=lazy antes da captura de página inteira
          await page.evaluate(async () => {
            for (let y = 0; y < document.body.scrollHeight; y += 600) {
              window.scrollTo(0, y);
              await new Promise((r) => setTimeout(r, 50));
            }
            window.scrollTo(0, 0);
          });
          await page.waitForLoadState('networkidle');
          await page.screenshot({ path: path.join(dir!, `${tela.nome}-${disp}-${tema}.png`), fullPage: true });
        });
      }
    }
  }

  for (const tema of TEMAS) {
    test(`modal do post, folha de compartilhar e excluir conta · ${tema}`, async ({ page, api }) => {
      api.login();
      await preparar(page, tema, TELAS_DISP.computador);
      await page.goto('/?feed=posts');
      await page.getByRole('link', { name: 'Troquei o carro pela bike por 30 dias. O resultado me surpreendeu' }).click();
      await expect(page.getByTestId('modal-post')).toBeVisible();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: path.join(dir!, `modal-post-computador-${tema}.png`) });
      await page.getByTestId('modal-post').getByTestId('compartilhar').click();
      await expect(page.getByTestId('folha-compartilhar')).toBeVisible();
      await page.screenshot({ path: path.join(dir!, `compartilhar-computador-${tema}.png`) });

      await preparar(page, tema, TELAS_DISP.celular);
      await page.goto('/?feed=posts');
      await page.getByRole('link', { name: 'O que ninguém te conta sobre começar a programar' }).click();
      await expect(page.getByTestId('modal-post')).toBeVisible();
      await page.screenshot({ path: path.join(dir!, `modal-post-celular-${tema}.png`) });

      await preparar(page, tema, TELAS_DISP.computador);
      await page.goto('/configuracoes/conta');
      await page.getByRole('button', { name: 'Excluir minha conta…' }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await page.screenshot({ path: path.join(dir!, `excluir-conta-${tema}.png`) });
    });

    test(`estúdio: as 4 abas · ${tema}`, async ({ page, api }) => {
      api.login();
      await preparar(page, tema, TELAS_DISP.computador);
      await page.goto('/publicar');
      await page.getByRole('textbox', { name: /^Título/ }).fill('Fim de tarde no Parque Barigui');
      await page.getByRole('textbox', { name: /^Subtítulo/ }).fill('Levei a câmera nova e o pôr do sol colaborou.');
      const estudio = page.getByTestId('estudio');
      await estudio.getByRole('button', { name: 'Pôr do sol', exact: true }).click();
      await estudio.screenshot({ path: path.join(dir!, `estudio-cor-${tema}.png`) });
      await estudio.getByRole('tab', { name: 'Aura e Material' }).click();
      await estudio.getByRole('button', { name: /^Brasa[\s,]/ }).click();
      await estudio.getByRole('group', { name: 'Aura Hype' }).getByRole('button', { name: 'Brilho', exact: true }).click();
      await page.getByTestId('previa-em-alta').click();
      await estudio.screenshot({ path: path.join(dir!, `estudio-aura-${tema}.png`) });
      await estudio.getByRole('tab', { name: 'Layout e Estilo' }).click();
      await estudio.getByRole('button', { name: 'Polaroid', exact: true }).click();
      await estudio.screenshot({ path: path.join(dir!, `estudio-layout-${tema}.png`) });
      await estudio.getByRole('tab', { name: 'Container' }).click();
      await estudio.getByRole('button', { name: 'Areia clara', exact: true }).click();
      await estudio.screenshot({ path: path.join(dir!, `estudio-container-${tema}.png`) });
    });

    test(`320 px com DejaVu Sans e texto a 150 % · ${tema}`, async ({ page, api }) => {
      api.login();
      await preparar(page, tema, { width: 320, height: 720 });
      for (const [nome, rota] of [
        ['feed', '/?feed=posts'],
        ['alertas', '/?feed=alertas'],
        ['publicar', '/publicar'],
      ] as const) {
        await page.goto(rota);
        await page.addStyleTag({ content: 'html, body, button, input, select, textarea { font-family: "DejaVu Sans", Verdana, sans-serif !important; }' });
        await page.evaluate(() => (document.documentElement.style.fontSize = '150%'));
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: path.join(dir!, `estreito-320-${nome}-${tema}.png`), fullPage: true });
      }
    });
  }
});
