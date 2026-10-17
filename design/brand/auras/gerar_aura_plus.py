"""Gera as artes animadas da Aura Plus (Background Studio) como a pesquisa recomenda: nunca GIF.

Para cada aura sai um loop sem emenda de 4 s em três variantes, mais um relatório de flashes:
  {id}-hq.mp4      AV1 (SVT-AV1), 24 fps, 360×480   — orçamento ≤ 400 KB
  {id}-leve.mp4    H.264 Main, 15 fps, 360×480      — orçamento ≤ 150 KB (reserva para quem não decodifica AV1)
  {id}-poster.webp quadro estático                  — orçamento ≤ 25 KB (reduzir movimento, economia de dados)
  verificacao.json tamanhos + checagem simples de flashes (WCAG 2.3.1)

A checagem aqui é só um filtro de sanidade (variação de luminância média por quadro e por bloco). No pipeline real
quem decide é o EA IRIS; ver docs/PESQUISA_BACKGROUND_STUDIO.md §4.4.

Uso: python3 gerar_aura_plus.py  (precisa de numpy, opencv-python-headless, pillow e ffmpeg com libx264/libsvtav1/libwebp)
"""
from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

AQUI = Path(__file__).resolve().parent
W, H, DURACAO = 360, 480, 4.0
BUDGET_KB = {"hq": 400, "leve": 150, "poster": 25}


def hexrgb(h: str) -> np.ndarray:
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float32) / 255.0


def fundo(topo: str, base: str, brilho: str, forca: float) -> np.ndarray:
    y = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
    img = hexrgb(topo) * (1 - y) + hexrgb(base) * y
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.sqrt(((xx - W / 2) / (W * 0.7)) ** 2 + ((yy - H * 1.02) / (H * 0.55)) ** 2)
    glow = np.clip(1 - d, 0, 1)[..., None] ** 2
    return np.clip(img + hexrgb(brilho) * glow * forca, 0, 1)


def brasa(t: float, rng_seed: int = 7) -> np.ndarray:
    """Brasas subindo sobre um fundo quente. Tudo periódico em DURACAO: o loop não tem emenda."""
    rng = np.random.default_rng(rng_seed)
    n = 90
    x0 = rng.uniform(0, W, n)
    fase = rng.uniform(0, 1, n)
    ciclos = rng.choice([1, 1, 2], n)                 # voltas completas por loop
    balanco = rng.uniform(4, 14, n)
    tam = rng.uniform(1.2, 3.4, n)
    cores = np.stack([hexrgb(c) for c in rng.choice(["#FFB703", "#FF6A2B", "#FF4D4D", "#FFD27A"], n)])
    respira = 0.5 + 0.5 * np.sin(2 * np.pi * t / DURACAO)            # 1 ciclo lento: nada de piscar
    img = fundo("#17120D", "#3A0E0A", "#FF6A2B", 0.30 + 0.05 * respira)
    camada = np.zeros((H, W, 3), np.float32)
    p = (t / DURACAO * ciclos + fase) % 1.0
    ys = H + 10 - p * (H + 20)
    xs = x0 + balanco * np.sin(2 * np.pi * (p * 2 + fase))
    alfa = np.clip(1.15 - p, 0, 1) * (0.75 + 0.25 * np.sin(2 * np.pi * (t / DURACAO * 3 + fase * 5)))
    for x, y, r, c, a in zip(xs, ys, tam, cores, alfa):
        cv2.circle(camada, (int(round(x)), int(round(y))), int(max(1, round(r))), (c * a).tolist(), -1, cv2.LINE_AA)
    halo = cv2.GaussianBlur(camada, (0, 0), 5)
    return np.clip(img + camada * 0.9 + halo * 1.6, 0, 1)


def aurora(t: float) -> np.ndarray:
    """Faixas de aurora que ondulam devagar; fases inteiras no período, sem emenda."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    img = fundo("#0B1026", "#1A1033", "#7B2FF7", 0.18)
    w = 2 * np.pi * t / DURACAO
    faixas = [("#3EE6C1", 0.30, 1, 0.0), ("#7B5CFF", 0.48, 2, 1.7), ("#4A93FF", 0.66, 1, 3.1)]
    for cor, centro, k, ph in faixas:
        curva = centro * H + 26 * np.sin(xx / W * 2 * np.pi + w * k + ph) + 12 * np.sin(xx / W * 5 * np.pi - w + ph)
        banda = np.exp(-((yy - curva) / 34) ** 2) * (0.55 + 0.15 * np.sin(w + ph))
        img += hexrgb(cor) * banda[..., None] * 0.55
    return np.clip(img, 0, 1)


AURAS = {"brasa": brasa, "aurora": aurora}


def luminancia(frame: np.ndarray) -> np.ndarray:
    lin = np.where(frame <= 0.04045, frame / 12.92, ((frame + 0.055) / 1.055) ** 2.4)
    return lin @ np.array([0.2126, 0.7152, 0.0722], np.float32)


def checar_flashes(frames: list[np.ndarray], fps: int) -> dict:
    """Maior variação de luminância entre quadros: média do quadro e pior bloco de 1/4 da área (filtro de sanidade)."""
    lums = [luminancia(f) for f in frames + frames[:1]]          # inclui a volta do loop
    media, bloco = 0.0, 0.0
    for a, b in zip(lums, lums[1:]):
        media = max(media, abs(float(a.mean() - b.mean())))
        for by in range(2):
            for bx in range(2):
                sa = a[by * H // 2:(by + 1) * H // 2, bx * W // 2:(bx + 1) * W // 2]
                sb = b[by * H // 2:(by + 1) * H // 2, bx * W // 2:(bx + 1) * W // 2]
                bloco = max(bloco, abs(float(sa.mean() - sb.mean())))
    # Flash geral (WCAG 2.3.1): variação ≥ 0,10 de luminância relativa. Aqui exigimos bem menos que isso.
    return {"fps": fps, "maior_variacao_media": round(media, 4), "maior_variacao_bloco": round(bloco, 4),
            "aprovado": bloco < 0.05}


def ffmpeg(*args: str) -> None:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def gerar(nome: str) -> dict:
    fn = AURAS[nome]
    rel: dict = {}
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        for variante, fps in (("hq", 24), ("leve", 15)):
            frames = [fn(i / fps) for i in range(int(DURACAO * fps))]
            pasta = tmp / variante
            pasta.mkdir()
            for i, f in enumerate(frames):
                Image.fromarray((f * 255).round().astype(np.uint8)).save(pasta / f"{i:03d}.png")
            saida = AQUI / f"{nome}-{variante}.mp4"
            entrada = ["-framerate", str(fps), "-i", str(pasta / "%03d.png")]
            if variante == "hq":
                ffmpeg(*entrada, "-c:v", "libsvtav1", "-crf", "42", "-preset", "6", "-pix_fmt", "yuv420p",
                       "-g", str(fps * 2), "-an", "-movflags", "+faststart", str(saida))
            else:
                ffmpeg(*entrada, "-c:v", "libx264", "-profile:v", "main", "-crf", "30", "-preset", "slow",
                       "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", str(saida))
            rel[variante] = {"arquivo": saida.name, "kb": round(saida.stat().st_size / 1024, 1),
                             "orcamento_kb": BUDGET_KB[variante]}
            if variante == "hq":
                rel["flashes"] = checar_flashes(frames, fps)
                poster = AQUI / f"{nome}-poster.webp"
                Image.fromarray((frames[0] * 255).round().astype(np.uint8)).save(poster, "WEBP", quality=70, method=6)
                rel["poster"] = {"arquivo": poster.name, "kb": round(poster.stat().st_size / 1024, 1),
                                 "orcamento_kb": BUDGET_KB["poster"]}
    return rel


def main() -> None:
    if not shutil.which("ffmpeg"):
        raise SystemExit("ffmpeg não encontrado")
    relatorio = {nome: gerar(nome) for nome in AURAS}
    for nome, r in relatorio.items():
        for k in ("hq", "leve", "poster"):
            assert r[k]["kb"] <= r[k]["orcamento_kb"], f"{nome}-{k} passou do orçamento: {r[k]}"
        assert r["flashes"]["aprovado"], f"{nome}: variação de luminância alta demais {r['flashes']}"
    (AQUI / "verificacao.json").write_text(json.dumps(relatorio, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(relatorio, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
