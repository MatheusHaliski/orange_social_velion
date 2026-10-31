import { defineConfig, devices } from '@playwright/test';

// Ponta a ponta contra o build de produção (next build && next start), com a API simulada por page.route.
// PW_CHROMIUM aponta para um Chromium já instalado (ex.: /opt/pw-browsers/chromium-1194/chrome-linux/chrome);
// sem ela, usa o navegador baixado por `npx playwright install chromium`.
// E2E_SKIP_BUILD=1 pula o next build quando ele acabou de rodar (CI).
const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${PORT}`;
const start = `npx next start -H 127.0.0.1 -p ${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
      },
    },
  ],
  webServer: {
    command: process.env.E2E_SKIP_BUILD ? start : `npx next build && ${start}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    stdout: 'ignore',
    stderr: 'pipe',
    // nenhum pedido chega ao backend: o navegador é interceptado antes; a origem inválida garante isso
    env: { API_ORIGIN: 'http://127.0.0.1:9', NEXT_TELEMETRY_DISABLED: '1' },
  },
});
