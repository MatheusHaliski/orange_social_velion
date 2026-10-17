#!/usr/bin/env python3
"""Gera os SVGs da marca Orange Social a partir da arte de referência.

    python3 design/brand/build_logo.py

Saídas (nesta pasta):
    orange-social-logo.svg  logo principal: a laranja "OS" no centro da rede de usuários
    orange-social-mark.svg  só a laranja, para tamanhos abaixo de 48 px (favicon, ícone de app, topbar)

Os nós da rede usam as 6 cores de categoria do design system (docs/DESIGN_SYSTEM.md §3): a marca
é literalmente a laranja conectando as categorias. PRETO aparece como cinza para ser visível no disco.
"""
from __future__ import annotations

import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
C = 256  # centro do viewBox 512×512

# Cores de categoria (tema escuro) — mesma ordem da tabela §3 do design system
NODE_COLORS = ["#3DDC6B", "#F7C948", "#4A93FF", "#FF9F1C", "#FF4D4D", "#7A7570"]
# Sequência fixa (não aleatória) para o SVG ser reprodutível e as cores ficarem bem distribuídas
PATTERN = [2, 1, 4, 0, 3, 5, 1, 2, 0, 4, 1, 3, 2, 5, 0, 1, 4, 2, 3, 0, 5, 2, 1, 4, 0, 3, 1, 2, 5, 4]

RINGS = [  # (raio, quantidade de nós, deslocamento angular em graus, raio do nó)
    (212, 30, 0.0, 9.5),
    (160, 22, 8.0, 9.5),
    (110, 14, 4.0, 9.0),
]


def ring_nodes():
    nodes = []
    k = 0
    for ri, (r, n, off, nr) in enumerate(RINGS):
        ring = []
        for i in range(n):
            a = math.radians(off + 360 * i / n - 90)
            ring.append((C + r * math.cos(a), C + r * math.sin(a), nr, NODE_COLORS[PATTERN[k % len(PATTERN)]]))
            k += 1
        nodes.append(ring)
    return nodes


def edges(nodes):
    out = set()

    def add(p, q):
        out.add((min(p, q), max(p, q)))

    for ri, ring in enumerate(nodes):
        n = len(ring)
        for i in range(n):
            add((ri, i), (ri, (i + 1) % n))       # vizinho no mesmo anel
            add((ri, i), (ri, (i + 2) % n))       # corda curta: dá o aspecto de malha
        if ri + 1 < len(nodes):                    # ligação com os 2 nós mais próximos do anel interno
            inner = nodes[ri + 1]
            for i, (x, y, *_ ) in enumerate(ring):
                near = sorted(range(len(inner)), key=lambda j: (inner[j][0] - x) ** 2 + (inner[j][1] - y) ** 2)[:2]
                for j in near:
                    add((ri, i), (ri + 1, j))
    inner = nodes[-1]                              # anel interno até o selo central (raios)
    for i in range(0, len(inner), 2):
        x, y, *_ = inner[i]
        out.add(((-1, i), (len(nodes) - 1, i)))
    return out


def f(v: float) -> str:
    return f"{v:.1f}".rstrip("0").rstrip(".")


ORANGE = """
  <g id="orange">
    <!-- folha e cabinho -->
    <path d="M256 196c-2-12-8-22-17-28" fill="none" stroke="#FFFFFF" stroke-width="15" stroke-linecap="round"/>
    <path d="M262 190c8-26 34-40 64-36-6 28-32 44-64 36z" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="12" stroke-linejoin="round"/>
    <path d="M256 196c-2-12-8-22-17-28" fill="none" stroke="#6B3E1F" stroke-width="7" stroke-linecap="round"/>
    <path d="M262 190c8-26 34-40 64-36-6 28-32 44-64 36z" fill="#3FA34D"/>
    <path d="M268 186c14-12 30-20 52-28" fill="none" stroke="#2E7D3A" stroke-width="2.5" stroke-linecap="round"/>
    <!-- fruta com contorno branco -->
    <circle cx="256" cy="268" r="82" fill="#FFFFFF"/>
    <circle cx="256" cy="268" r="70" fill="url(#fruit)"/>
    <!-- faceta em losango (o glifo VERDE da identidade) -->
    <path d="M256 204 320 268 256 332 192 268z" fill="#FF8A2E" opacity=".55"/>
    <path d="M256 268 320 268 256 332z" fill="#E8590C" opacity=".35"/>
    <text x="256" y="290" text-anchor="middle" font-family="Inter, 'Helvetica Neue', Arial, sans-serif"
          font-size="62" font-weight="800" letter-spacing="-1" fill="#FFFFFF">OS</text>
  </g>"""

DEFS = """
  <defs>
    <radialGradient id="disc" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#FF8F3A"/>
      <stop offset=".55" stop-color="#F27A22"/>
      <stop offset=".82" stop-color="#A9672C"/>
      <stop offset="1" stop-color="#6E5236"/>
    </radialGradient>
    <linearGradient id="fruit" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFA24A"/>
      <stop offset=".55" stop-color="#FF7A1F"/>
      <stop offset="1" stop-color="#F0610F"/>
    </linearGradient>
  </defs>"""


def logo() -> str:
    nodes = ring_nodes()
    lines = []
    for (ra, ia), (rb, ib) in sorted(edges(nodes)):
        if ra == -1:
            x1, y1 = C, C + 12
        else:
            x1, y1, *_ = nodes[ra][ia]
        x2, y2, *_ = nodes[rb][ib]
        lines.append(f'<line x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}"/>')
    dots = [f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}" fill="{c}"/>' for ring in nodes for x, y, r, c in ring]
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-labelledby="t">
  <title id="t">Orange Social</title>{DEFS}
  <circle cx="256" cy="256" r="244" fill="url(#disc)" stroke="#2B231C" stroke-width="10"/>
  <g stroke="#FFF4E8" stroke-width="2.2" stroke-linecap="round" opacity=".9">
    {chr(10).join('    ' + l for l in lines).lstrip()}
  </g>
  <g stroke="#2B231C" stroke-opacity=".35" stroke-width="1.5">
    {chr(10).join('    ' + d for d in dots).lstrip()}
  </g>{ORANGE}
</svg>
"""


def mark() -> str:
    # Mesma laranja, recentralizada e sem a rede (que vira ruído abaixo de 48 px)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="168 146 176 208" role="img" aria-labelledby="t">
  <title id="t">Orange Social</title>{DEFS}{ORANGE}
</svg>
"""


if __name__ == "__main__":
    (HERE / "orange-social-logo.svg").write_text(logo(), encoding="utf-8")
    (HERE / "orange-social-mark.svg").write_text(mark(), encoding="utf-8")
    print("ok orange-social-logo.svg, orange-social-mark.svg")
