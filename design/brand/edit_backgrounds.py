#!/usr/bin/env python3
"""Troca os logos genéricos das artes de mosaico pelo logo oficial do Orange e gera os fundos do app.

    pip install opencv-python-headless pillow numpy   # num venv
    python design/brand/edit_backgrounds.py

Entradas em backgrounds/src/ (artes originais). Saídas em backgrounds/:
    {nome}.webp       resolução original (~1200 px), para o fundo do app
    {nome}-thumb.webp 320 px, para a escolha em Configurações → Exibição

Como funciona:
  * "placa" (mosaicos clássico, profundo, brilho, céu): o ícone de rede genérico dentro da placa escura é
    removido por inpainting só nos pixels do ícone (a textura da placa e o texto "ORANGE SOCIAL" ficam),
    e o logo oficial (orange-social-mark-528.png) entra centrado no mesmo lugar.
  * "balão" (mosaico areia): o balãozinho de mensagem é coberto pelo logo oficial; a "cauda" do balão,
    que ficaria aparecendo, é reconstruída por inpainting a partir das pastilhas em volta.
Coordenadas medidas nas artes originais (grade de 20 px).
"""
from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
SRC = HERE / "backgrounds" / "src"
OUT = HERE / "backgrounds"
MARK = Image.open(HERE / "orange-social-mark-528.png").convert("RGBA")
# geometria do PNG do mark: círculo branco com centro (264, 366) e raio 246
MARK_CX, MARK_CY, MARK_R = 264, 366, 246

ART = [
    # nome, tipo, centro do ícone (x, y), raio do ícone, faixa vertical da placa (topo, texto abaixo), raio do logo
    ("mosaico-classico", "placa", (418, 423), 58, (374, 478), 50),
    ("mosaico-profundo", "placa", (418, 408), 56, (362, 462), 48),
    ("mosaico-brilho", "placa", (415, 411), 56, (364, 466), 48),
    ("mosaico-ceu", "placa", (411, 406), 56, (358, 462), 48),
    ("mosaico-areia", "balao", (269, 425), 72, None, 72),
]


def icon_mask(img: np.ndarray, center, radius: int, band) -> np.ndarray:
    """Pixels do ícone genérico: diferentes da cor da placa, dentro do disco e da placa (sem as pastilhas
    da borda de cima nem o texto "ORANGE SOCIAL" de baixo)."""
    h, w, _ = img.shape
    yy, xx = np.mgrid[0:h, 0:w]
    disc = (xx - center[0]) ** 2 + (yy - center[1]) ** 2 <= radius ** 2
    top, bottom = band
    disc &= (yy > top) & (yy < bottom)
    ring = disc & ((xx - center[0]) ** 2 + (yy - center[1]) ** 2 >= (radius - 6) ** 2)
    plaque = np.median(img[ring], axis=0)
    dist = np.linalg.norm(img.astype(int) - plaque, axis=-1)
    mask = (disc & (dist > 48)).astype(np.uint8) * 255
    mask = cv2.dilate(mask, np.ones((5, 5), np.uint8), iterations=2)
    mask[(yy <= top) | (yy >= bottom)] = 0
    return mask


def bubble_tail_mask(img: np.ndarray, center, radius: int) -> np.ndarray:
    """Cauda do balão (canto inferior esquerdo, fora do círculo que o logo cobre)."""
    h, w, _ = img.shape
    mask = np.zeros((h, w), np.uint8)
    cx, cy = center
    pts = np.array([[cx - 74, cy + 34], [cx - 34, cy + 66], [cx - 46, cy + 82], [cx - 74, cy + 80]], np.int32)
    cv2.fillPoly(mask, [pts], 255)
    yy, xx = np.mgrid[0:h, 0:w]
    mask[(xx - cx) ** 2 + (yy - cy) ** 2 <= (radius - 2) ** 2] = 0   # o logo cobre o resto
    return cv2.dilate(mask, np.ones((3, 3), np.uint8), iterations=2)


def add_grain(img: np.ndarray, mask: np.ndarray, reference: np.ndarray) -> np.ndarray:
    """Devolve à área reconstruída o "grão" da placa, que o inpainting alisa."""
    std = float(np.std(reference)) if reference.size else 6.0
    noise = np.random.default_rng(7).normal(0, min(std, 14) * 0.6, img.shape)
    out = img.astype(float)
    m = (mask > 0)[..., None]
    out = np.where(m, out + noise, out)
    return np.clip(out, 0, 255).astype(np.uint8)


def paste_mark(base: Image.Image, center, radius: int) -> Image.Image:
    scale = radius / MARK_R
    mark = MARK.resize((round(MARK.width * scale), round(MARK.height * scale)), Image.LANCZOS)
    # sombra suave para o logo "assentar" na placa
    shadow = Image.new("RGBA", mark.size, (0, 0, 0, 0))
    alpha = mark.split()[-1].point(lambda a: int(a * 0.45))
    shadow.putalpha(alpha)
    x = round(center[0] - MARK_CX * scale)
    y = round(center[1] - MARK_CY * scale)
    out = base.convert("RGBA")
    out.alpha_composite(shadow, (x + max(1, radius // 25), y + max(2, radius // 12)))
    out.alpha_composite(mark, (x, y))
    return out.convert("RGB")


def main() -> None:
    for name, kind, center, icon_r, band, logo_r in ART:
        rgb = np.asarray(Image.open(SRC / f"{name}.webp").convert("RGB"))
        bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
        if kind == "placa":
            mask = icon_mask(rgb, center, icon_r, band)
            fixed = cv2.inpaint(bgr, mask, 9, cv2.INPAINT_TELEA)
            plaque_px = bgr[(cv2.dilate(mask, np.ones((15, 15), np.uint8)) > 0) & (mask == 0)]
            fixed = add_grain(fixed, mask, plaque_px)
        else:
            mask = bubble_tail_mask(rgb, center, logo_r)
            fixed = cv2.inpaint(bgr, mask, 7, cv2.INPAINT_TELEA)
        edited = paste_mark(Image.fromarray(cv2.cvtColor(fixed, cv2.COLOR_BGR2RGB)), center, logo_r)

        full = edited  # resolução original (1184–1200 px): ampliar só aumentaria o arquivo
        full.save(OUT / f"{name}.webp", "WEBP", quality=80, method=6)
        thumb = edited.resize((320, round(edited.height * 320 / edited.width)), Image.LANCZOS)
        thumb.save(OUT / f"{name}-thumb.webp", "WEBP", quality=78, method=6)
        print("ok", name)


if __name__ == "__main__":
    main()
