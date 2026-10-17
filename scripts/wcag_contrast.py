#!/usr/bin/env python3
"""Verifica o contraste WCAG 2.x das cores do design system Orange Social.

Uso:
    python3 scripts/wcag_contrast.py            # tabela completa
    python3 scripts/wcag_contrast.py "#3DDC6B" "#17120D"   # um par

Limiares: 4.5:1 texto normal (AA), 3:1 texto grande e elementos não textuais (1.4.11).
"""
import sys

DARK_BG = "#17120D"   # warm charcoal (fundo do tema escuro)
LIGHT_BG = "#FFFFFF"

# (nome, cor original, variante proposta para o tema claro)
CATEGORIES = [
    ("VERDE · pessoa física",     "#3DDC6B", "#1E7A3A"),
    ("AMARELO · imprensa",        "#F7C948", "#8B6B00"),
    ("AZUL · marketing",          "#4A93FF", "#1D5FCC"),
    ("LARANJA · comunidade",      "#FF9F1C", "#A85200"),
    ("VERMELHO · instituição",    "#FF4D4D", "#C5221F"),
    ("PRETO · especial",          "#0C0A07", "#0C0A07"),
    ("ORANGE · marca",            "#FF6A2B", "#C2410C"),
    ("Anel p/ PRETO no escuro",   "#D6D0C8", None),
]


def _channel(c: int) -> float:
    c /= 255.0
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def luminance(hex_color: str) -> float:
    h = hex_color.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * _channel(r) + 0.7152 * _channel(g) + 0.0722 * _channel(b)


def contrast(fg: str, bg: str) -> float:
    l1, l2 = sorted((luminance(fg), luminance(bg)), reverse=True)
    return (l1 + 0.05) / (l2 + 0.05)


def verdict(ratio: float) -> str:
    if ratio >= 4.5:
        return "AA texto"
    if ratio >= 3.0:
        return "só não-textual"
    return "REPROVA"


def main(argv: list[str]) -> int:
    if len(argv) == 3:
        r = contrast(argv[1], argv[2])
        print(f"{argv[1]} sobre {argv[2]}: {r:.2f}:1 → {verdict(r)}")
        return 0

    print(f"{'Cor':<28}{'Hex':<10}{'escuro':>8}  {'veredito':<16}{'branco':>8}  {'veredito':<16}{'claro→':<10}{'branco':>8}  veredito")
    print("-" * 122)
    for name, hex_color, light_variant in CATEGORIES:
        on_dark = contrast(hex_color, DARK_BG)
        on_light = contrast(hex_color, LIGHT_BG)
        line = (f"{name:<28}{hex_color:<10}{on_dark:>7.2f}  {verdict(on_dark):<16}"
                f"{on_light:>7.2f}  {verdict(on_light):<16}")
        if light_variant and light_variant != hex_color:
            lv = contrast(light_variant, LIGHT_BG)
            line += f"{light_variant:<10}{lv:>7.2f}  {verdict(lv)}"
        print(line)

    print()
    btn_dark = contrast("#17120D", "#FF6A2B")
    btn_white = contrast("#FFFFFF", "#FF6A2B")
    print(f"Texto sobre botão ORANGE: #17120D → {btn_dark:.2f}:1 ({verdict(btn_dark)}); "
          f"#FFFFFF → {btn_white:.2f}:1 ({verdict(btn_white)})")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
