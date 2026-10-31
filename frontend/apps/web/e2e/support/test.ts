// Fixture de teste com a API simulada já instalada e o verificador de acessibilidade (axe).
import AxeBuilder from '@axe-core/playwright';
import { test as base, expect, type Page } from '@playwright/test';
import { MockApi } from './mock-api';

export const test = base.extend<{ api: MockApi }>({
  // automático: toda página tem a API simulada, mesmo quando o teste não usa `api`
  api: [
    async ({ page, context }, use) => {
      const api = new MockApi(page, context);
      await api.install();
      await use(api);
    },
    { auto: true },
  ],
});

export { expect };

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Falha com violações serious/critical do axe; roda no tema da página (use emulateMedia para o outro). */
export async function expectAccessible(page: Page, where: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const graves = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const resumo = graves.map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map((n) => n.target.join(' ')).join('\n  ')}`);
  expect(resumo, `axe em ${where}`).toEqual([]);
}

/** Confere nos dois temas: claro e escuro (preferência do sistema). */
export async function expectAccessibleInBothThemes(page: Page, where: string): Promise<void> {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await expectAccessible(page, `${where} (tema ${colorScheme === 'light' ? 'claro' : 'escuro'})`);
  }
}
