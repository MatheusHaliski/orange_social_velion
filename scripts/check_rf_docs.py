#!/usr/bin/env python3
"""Garante que os diagramas por RF (docs/rf/) existem e acompanham o código.

Uso:
    python3 scripts/check_rf_docs.py                    # estrutura
    python3 scripts/check_rf_docs.py --base origin/main # + desatualização em relação a um ref

Regras: ver docs/rf/README.md. Sai com código 1 se algo falhar.

Exceção por commit (o marcador precisa começar a linha da mensagem):
    [rf-docs-skip] motivo            ignora a desatualização de todos os RFs
    [rf-docs-skip: RF2, RF3] motivo  ignora só os RFs listados
"""
from __future__ import annotations

import argparse
import fnmatch
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RF_DIR = ROOT / "docs" / "rf"
CATALOG = RF_DIR / "README.md"
REQUIRED = ("rf", "titulo", "status", "paths")
STATUSES = {"planejado", "parcial", "pronto"}
SKIP_MARK = "[rf-docs-skip]"
# Só no início de uma linha: citar o marcador no meio de um texto não deve desligar a verificação.
SKIP_RE = re.compile(r"^\[rf-docs-skip(?::\s*([^\]]*))?\]", re.M)


def parse_front_matter(text: str) -> dict:
    """Lê o cabeçalho YAML simples (chave: valor, listas com '- ' e [a, b])."""
    m = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    if not m:
        return {}
    data: dict = {}
    key = None
    for line in m.group(1).splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        item = re.match(r"^\s+-\s+(.*)$", line)
        if item and key:
            data.setdefault(key, []).append(item.group(1).split("  #")[0].strip())
            continue
        kv = re.match(r"^([A-Za-z_]+):\s*(.*)$", line)
        if kv:
            key, val = kv.group(1), kv.group(2).split("  #")[0].strip()
            if val.startswith("[") and val.endswith("]"):
                data[key] = [v.strip() for v in val[1:-1].split(",") if v.strip()]
            elif val:
                data[key] = val
            else:
                data[key] = []
    return data


def load_docs() -> list[tuple[Path, dict, str]]:
    return [(p, parse_front_matter(p.read_text(encoding="utf-8")), p.read_text(encoding="utf-8"))
            for p in sorted(RF_DIR.glob("RF*.md"))]


def tracked_files() -> list[str]:
    out = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    return out.splitlines()


def matches(path: str, patterns: list[str]) -> bool:
    return any(fnmatch.fnmatch(path, pat) for pat in patterns)


def check_structure(docs, files: list[str]) -> list[str]:
    errors: list[str] = []
    catalog = CATALOG.read_text(encoding="utf-8") if CATALOG.exists() else ""
    seen: dict[str, Path] = {}
    for path, fm, text in docs:
        rel = path.relative_to(ROOT)
        missing = [k for k in REQUIRED if not fm.get(k)]
        if missing:
            errors.append(f"{rel}: cabeçalho sem {', '.join(missing)}")
            continue
        rf = fm["rf"]
        if not re.fullmatch(r"RF\d+", rf):
            errors.append(f"{rel}: rf '{rf}' fora do padrão RFn")
        if rf in seen:
            errors.append(f"{rel}: {rf} duplicado (também em {seen[rf].name})")
        seen[rf] = path
        if fm["status"] not in STATUSES:
            errors.append(f"{rel}: status '{fm['status']}' inválido ({', '.join(sorted(STATUSES))})")
        if "```mermaid" not in text:
            errors.append(f"{rel}: nenhum diagrama Mermaid")
        for pat in fm["paths"]:
            if not any(fnmatch.fnmatch(f, pat) for f in files):
                errors.append(f"{rel}: path '{pat}' não corresponde a nenhum arquivo versionado")
        if path.name not in catalog:
            errors.append(f"{rel}: {rf} não está no catálogo docs/rf/README.md")
    for link in re.findall(r"\((RF[^)]+\.md)\)", catalog):
        if not (RF_DIR / link).exists():
            errors.append(f"docs/rf/README.md: link para {link} inexistente")
    return errors


def check_drift(docs, base: str) -> list[str]:
    rng = f"{base}...HEAD"
    changed = subprocess.run(["git", "diff", "--name-only", rng], cwd=ROOT,
                             capture_output=True, text=True, check=True).stdout.splitlines()
    messages = subprocess.run(["git", "log", "--format=%B", rng], cwd=ROOT,
                              capture_output=True, text=True, check=True).stdout
    skipped: set[str] = set()
    for m in SKIP_RE.finditer(messages):
        if not m.group(1):
            print(f"aviso: {SKIP_MARK} encontrado nos commits de {rng}; verificação de desatualização ignorada")
            return []
        skipped |= {rf.strip().upper() for rf in m.group(1).split(",") if rf.strip()}
    if skipped:
        print(f"aviso: desatualização ignorada para {', '.join(sorted(skipped))} ({SKIP_MARK} nos commits de {rng})")
    errors: list[str] = []
    for path, fm, _ in docs:
        rel = str(path.relative_to(ROOT))
        if not fm.get("paths") or rel in changed or fm["rf"].upper() in skipped:
            continue
        touched = sorted(f for f in changed if matches(f, fm["paths"]))
        if touched:
            errors.append(f"{fm['rf']}: código mudou ({', '.join(touched)}) mas {rel} não foi atualizado")
    return errors


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--base", help="ref para comparar (ex.: origin/main ou um SHA)")
    args = ap.parse_args()

    docs = load_docs()
    errors = check_structure(docs, tracked_files())
    if args.base:
        errors += check_drift(docs, args.base)

    print(f"{len(docs)} documento(s) de RF verificados")
    for e in errors:
        print(f"ERRO {e}")
    if errors:
        print(f"\nVeja as regras em docs/rf/README.md (use {SKIP_MARK} ou [rf-docs-skip: RFn] no início de uma linha "
              "do commit só para mudanças sem efeito no comportamento daquele RF).")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
