#!/usr/bin/env python3
"""Gera o fundo em mosaico das telas de entrada (login e cadastro) do Orange Social.

    python3 design/brand/build_mosaic.py

Saída: orange-social-mosaic.svg (1200×900, sem texto). Recriação vetorial da arte de referência:
pastilhas laranja em anéis em volta de "pessoas", ligadas por caminhos claros — a rede da marca.
O texto e o logo NÃO entram aqui: a tela sobrepõe a assinatura oficial (orange-social-mark.svg +
"Orange Social") em HTML, nítida e legível por leitor de tela. A semente fixa torna o SVG reprodutível.
"""
from __future__ import annotations

import math
import random
from pathlib import Path

HERE = Path(__file__).resolve().parent
W, H = 1200, 900
TILE = 26          # lado da pastilha da malha de fundo
GAP = 3
rng = random.Random(20261017)

# Paleta do mosaico: laranjas da marca + creme; pesos aproximam a proporção da arte de referência
PALETTE = [("#F28C28", 9), ("#F5A04A", 7), ("#E8702A", 7), ("#F7B267", 5), ("#D9541E", 4),
           ("#FBC78D", 3), ("#F4E1C1", 2), ("#E35D3A", 3), ("#C8461C", 2)]
CREAM = "#F6E7CF"
COLORS = [c for c, w in PALETTE for _ in range(w)]

# "Pessoas" (centros dos anéis) e caminhos que as ligam
HUBS = [(150, 150, 3), (480, 135, 3), (690, 95, 2), (1040, 250, 3), (680, 300, 2), (820, 320, 2),
        (1080, 760, 3), (120, 700, 3), (300, 690, 2), (840, 640, 3), (450, 610, 2), (970, 600, 2)]
RING = 22
PATHS = [
    "M -20 330 C 180 210 330 250 470 260 S 760 300 900 160 S 1150 120 1230 60",
    "M -20 560 C 220 520 300 470 520 520 S 830 600 1000 520 S 1150 470 1230 500",
    "M 80 900 C 160 760 330 760 430 640 S 640 590 700 700 S 820 880 1000 840",
    "M 600 -20 C 610 120 560 200 640 280 S 780 380 760 470",
]


def f(v: float) -> str:
    return f"{v:.1f}".rstrip("0").rstrip(".")


def tile(x: float, y: float, size: float, angle: float, color: str) -> str:
    return (f'<rect x="{f(x - size / 2)}" y="{f(y - size / 2)}" width="{f(size)}" height="{f(size)}" rx="3" '
            f'fill="{color}" transform="rotate({f(angle)} {f(x)} {f(y)})"/>')


def near_hub(x: float, y: float) -> bool:
    return any(math.hypot(x - hx, y - hy) < RING * (rings + 1.4) for hx, hy, rings in HUBS)


def background_tiles() -> list[str]:
    out = []
    step = TILE + GAP
    for row in range(-1, H // step + 2):
        for col in range(-1, W // step + 2):
            x = col * step + rng.uniform(-4, 4) + (step / 2 if row % 2 else 0)
            y = row * step + rng.uniform(-4, 4)
            if near_hub(x, y):
                continue
            out.append(tile(x, y, TILE * rng.uniform(0.82, 1.0), rng.uniform(-9, 9), rng.choice(COLORS)))
    return out


def hub(hx: float, hy: float, rings: int) -> list[str]:
    out = []
    for r in range(1, rings + 2):
        radius = RING * r + 6
        n = max(8, int(2 * math.pi * radius / (TILE * 0.95)))
        for i in range(n):
            a = 2 * math.pi * i / n + r * 0.4
            color = CREAM if r == 1 and rng.random() < 0.6 else rng.choice(COLORS)
            out.append(tile(hx + radius * math.cos(a), hy + radius * math.sin(a), TILE * 0.8,
                            math.degrees(a), color))
    # a pessoa: cabeça + ombros, em creme sobre um disco laranja
    out.append(f'<circle cx="{f(hx)}" cy="{f(hy)}" r="{RING - 3}" fill="#E8702A"/>')
    out.append(f'<circle cx="{f(hx)}" cy="{f(hy - 6)}" r="6.5" fill="{CREAM}"/>')
    out.append(f'<path d="M {f(hx - 11)} {f(hy + 12)} a 11 10 0 0 1 22 0 z" fill="{CREAM}"/>')
    return out


def build() -> str:
    paths = "\n    ".join(
        f'<path d="{d}" fill="none" stroke="{CREAM}" stroke-width="15" stroke-dasharray="17 4" opacity=".9"/>'
        for d in PATHS)
    glow = "\n    ".join(
        f'<path d="{d}" fill="none" stroke="#FFD9A8" stroke-width="2" opacity=".55"/>' for d in PATHS)
    body = "\n  ".join(background_tiles())
    hubs = "\n  ".join(t for hx, hy, r in HUBS for t in hub(hx, hy, r))
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <rect width="{W}" height="{H}" fill="#B9461A"/>
  {body}
  <g>
    {paths}
  </g>
  {hubs}
  <g>
    {glow}
  </g>
</svg>
"""


if __name__ == "__main__":
    (HERE / "orange-social-mosaic.svg").write_text(build(), encoding="utf-8")
    print("ok orange-social-mosaic.svg")
