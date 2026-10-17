# Requisitos funcionais — diagramas por RF

Cada requisito funcional tem **um documento próprio** nesta pasta, com diagramas Mermaid (caso de uso,
sequência, estados ou atividades), critérios de aceite, base legal e rastreabilidade até código, testes,
telas e cards do Trello.

## Catálogo

| RF | Título | Status | Documento |
|---|---|---|---|
| RF1 | Cadastro de usuário (VSusercontrolist) | 🟡 parcial | [RF01-cadastro-usuario.md](RF01-cadastro-usuario.md) |
| RF2 | Editar informações pessoais e preferências do perfil | 🟡 parcial | [RF02-editar-perfil.md](RF02-editar-perfil.md) |
| RF3 | Gerenciar consentimentos e privacidade *(escopo inferido)* | 🟡 parcial | [RF03-consentimento-privacidade.md](RF03-consentimento-privacidade.md) |
| RF23 | Direitos do titular — portabilidade e eliminação *(escopo inferido)* | 🟡 parcial | [RF23-direitos-titular-lgpd.md](RF23-direitos-titular-lgpd.md) |
| RF24 | Visualizar post em detalhe (modal, data de publicação) *(numeração provisória)* | 🟡 parcial | [RF24-visualizar-post.md](RF24-visualizar-post.md) |
| RF25 | Perfil público do autor com o feed dele *(numeração provisória)* | 🟡 parcial | [RF25-perfil-publico-autor.md](RF25-perfil-publico-autor.md) |
| RF26 | Interações com contagem: curtir, comentar, compartilhar, salvar *(numeração provisória)* | 🟡 parcial | [RF26-interacoes-post.md](RF26-interacoes-post.md) |

> RF4–RF22 ainda não têm documento: a lista oficial não está no repositório. RF24–RF26 nasceram da
> auditoria de 2026-10-17 e foram numerados depois de RF23 para não colidir; renumerar quando a lista
> oficial chegar. Ao adicionar RFs, siga a regra abaixo.

## Regra: diagramas sempre atualizados

1. **RF novo** → crie `RFnn-slug.md` nesta pasta com o cabeçalho abaixo e adicione a linha no catálogo.
2. **Mudança de comportamento** em código listado em `paths` de um RF → atualize os diagramas e a tabela
   de rastreabilidade **no mesmo PR**.
3. O CI (job **Docs por RF**) verifica as duas coisas e também renderiza todo Mermaid de `docs/`:
   - estrutura: todo RF do catálogo tem documento, cabeçalho completo e ao menos um diagrama;
   - desatualização: se um arquivo de `paths` mudou e o documento do RF não, o job falha;
   - sintaxe: um diagrama que não renderiza falha o job.
4. Mudança sem efeito no comportamento (renomear, formatar)? Comece uma linha da mensagem de um commit
   do PR com `[rf-docs-skip: RF2, RF3] motivo` para dispensar só os RFs listados, ou `[rf-docs-skip] motivo`
   para todos. O marcador só vale no início da linha: citá-lo no meio de um texto não desliga nada.

### Cabeçalho obrigatório

```yaml
---
rf: RF7                       # ID oficial
titulo: Título do requisito
status: planejado | parcial | pronto
cards: [OS-xx]                # cards do Trello
paths:                        # código que implementa o RF (glob)
  - src/main/java/com/orangesocial/...
---
```

Verificação local: `python3 scripts/check_rf_docs.py` (estrutura) e
`python3 scripts/check_rf_docs.py --base origin/main` (desatualização em relação à `main`).

## Diagramas transversais

Valem para vários RFs e seguem a mesma regra de atualização:
[classes](../DIAGRAMA_CLASSES.md) · [estados](../MAQUINA_ESTADOS.md) · [componentes](../DIAGRAMA_COMPONENTES.md) ·
[sequência do Audio Feed](../DIAGRAMA_SEQUENCIA.md) · [atividades do cadastro](../DIAGRAMA_ATIVIDADES.md).
