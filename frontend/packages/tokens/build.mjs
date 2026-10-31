// Gera dist/tokens.css (temas claro e escuro) e dist/tokens.ts a partir dos tokens DTCG em tokens/.
// Uso: npm run build -w @orange-social/tokens (o npm install e os scripts da raiz já chamam).
import StyleDictionary from 'style-dictionary';

const PREFIXO = 'os';

/** Nome da variável sem o prefixo do tema: tema.escuro.color.bg → color-bg. */
function nome(token) {
  const caminho = token.path[0] === 'tema' ? token.path.slice(2) : token.path;
  return caminho.join('-');
}

function tema(token) {
  return token.path[0] === 'tema' ? token.path[1] : 'base';
}

function valor(token) {
  const v = token.$value ?? token.value;
  if (Array.isArray(v)) {
    return v.map((f) => (/\s/.test(f) ? `"${f}"` : f)).join(', ');
  }
  return String(v);
}

function grupos(dictionary) {
  const out = { base: [], claro: [], escuro: [] };
  for (const token of dictionary.allTokens) {
    out[tema(token)].push(token);
  }
  return out;
}

function bloco(seletor, tokens, extra = '') {
  const linhas = tokens.map((t) => `  --${PREFIXO}-${nome(t)}: ${valor(t)};`);
  return `${seletor} {\n${extra}${linhas.join('\n')}\n}\n`;
}

StyleDictionary.registerFormat({
  name: 'os/css-temas',
  format: ({ dictionary }) => {
    const g = grupos(dictionary);
    const escuro = (seletor) => bloco(seletor, g.escuro, '  color-scheme: dark;\n');
    return [
      '/* Gerado por packages/tokens/build.mjs a partir de tokens/*.json (DTCG). Não edite à mão. */',
      bloco(':root', g.base),
      '/* Tema claro: padrão e data-theme="light". */',
      bloco(':root', g.claro, '  color-scheme: light;\n'),
      '/* Tema escuro: preferência do sistema, a menos que a pessoa tenha escolhido o claro. */',
      `@media (prefers-color-scheme: dark) {\n${escuro(':root:not([data-theme="light"])').replace(/^/gm, '  ').trimEnd()}\n}\n`,
      '/* Tema escuro escolhido à mão. */',
      escuro(':root[data-theme="dark"]'),
    ].join('\n');
  },
});

StyleDictionary.registerFormat({
  name: 'os/ts',
  format: ({ dictionary }) => {
    const g = grupos(dictionary);
    const mapa = (tokens) =>
      `{\n${tokens.map((t) => `    ${JSON.stringify(nome(t))}: ${JSON.stringify(valor(t))},`).join('\n')}\n  }`;
    return [
      '// Gerado por packages/tokens/build.mjs a partir de tokens/*.json (DTCG). Não edite à mão.',
      '',
      'export const tokens = {',
      `  base: ${mapa(g.base)},`,
      `  light: ${mapa(g.claro)},`,
      `  dark: ${mapa(g.escuro)},`,
      '} as const;',
      '',
      "export type Tema = 'light' | 'dark';",
      'export type TokenDeCor = keyof typeof tokens.light;',
      '',
      `/** Referência CSS de um token, ex.: cssVar('color-bg') → var(--${PREFIXO}-color-bg). */`,
      'export function cssVar(nome: TokenDeCor | keyof typeof tokens.base): string {',
      `  return \`var(--${PREFIXO}-\${nome})\`;`,
      '}',
      '',
    ].join('\n');
  },
});

const sd = new StyleDictionary({
  source: ['tokens/base.json', 'tokens/tema/*.json'],
  log: { verbosity: 'default' },
  platforms: {
    css: {
      transforms: ['name/kebab'],
      buildPath: 'dist/',
      files: [{ destination: 'tokens.css', format: 'os/css-temas' }],
    },
    ts: {
      transforms: ['name/kebab'],
      buildPath: 'dist/',
      files: [{ destination: 'tokens.ts', format: 'os/ts' }],
    },
  },
});

await sd.buildAllPlatforms();
