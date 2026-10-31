package com.orangesocial.application.media;

import org.w3c.dom.Node;

import javax.imageio.IIOException;
import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReadParam;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.metadata.IIOMetadata;
import javax.imageio.metadata.IIOMetadataNode;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.ImageOutputStream;
import javax.imageio.stream.MemoryCacheImageInputStream;
import javax.imageio.stream.MemoryCacheImageOutputStream;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.Locale;

/**
 * Limpa a foto enviada antes de ela virar pública (foto do post RF29, foto de perfil RF2 · LGPD Art. 6º, III: só o
 * necessário).
 *
 * <ul>
 *   <li>o formato vem dos bytes, não do {@code Content-Type} declarado: só JPEG e PNG;</li>
 *   <li>largura e altura são lidas do cabeçalho <b>antes</b> de decodificar, contra "bombas" de descompressão;</li>
 *   <li>a orientação do EXIF é aplicada aos pixels (a foto do celular não fica deitada);</li>
 *   <li>a imagem é redesenhada e gravada de novo sem nenhum metadado: some EXIF, GPS, modelo do aparelho,
 *       miniatura embutida e comentários;</li>
 *   <li>tamanho conforme o uso ({@link Fit}): foto do post com lado maior até {@value #MAX_SIDE} px; foto de perfil
 *       recortada em quadrado no centro, com {@value #AVATAR_SIDE} px;</li>
 *   <li>com transparência sai PNG, sem, JPEG de qualidade 0,85.</li>
 * </ul>
 */
public final class ImageSanitizer {

    public static final int MAX_SIDE = 2048;
    public static final int AVATAR_SIDE = 512;
    /** Acima disso nem decodifica: 80 MP já cobre câmeras de celular de 48/50 MP com folga. */
    static final long MAX_PIXELS = 80_000_000L;
    static final int MAX_DIMENSION = 20_000;
    static final float JPEG_QUALITY = 0.85f;
    private static final int APP1 = 0xE1;

    private ImageSanitizer() {
    }

    /** Para onde vai a foto: define o tamanho final e se ela vira um quadrado. */
    public enum Fit {
        POST(MAX_SIDE, false),
        AVATAR(AVATAR_SIDE, true);

        final int side;
        final boolean square;

        Fit(int side, boolean square) {
            this.side = side;
            this.square = square;
        }
    }

    public record CleanImage(byte[] bytes, String contentType, String extension, int width, int height) {
    }

    /** Foto recusada; a mensagem vai para o autor. */
    public static final class Rejected extends RuntimeException {
        public Rejected(String message) {
            super(message);
        }
    }

    public static CleanImage sanitize(byte[] input) {
        return sanitize(input, Fit.POST);
    }

    public static CleanImage sanitize(byte[] input, Fit fit) {
        // cache só em memória: o original (com GPS) nunca vai para um arquivo temporário no disco
        try (ImageInputStream in = new MemoryCacheImageInputStream(new ByteArrayInputStream(input))) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(in);
            if (!readers.hasNext()) {
                throw new Rejected("O arquivo não é uma foto JPEG ou PNG.");
            }
            ImageReader reader = readers.next();
            try {
                String format = reader.getFormatName().toLowerCase(Locale.ROOT);
                if (!format.equals("jpeg") && !format.equals("png")) {
                    throw new Rejected("O arquivo não é uma foto JPEG ou PNG.");
                }
                reader.setInput(in, true, false);
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if (width < 1 || height < 1 || width > MAX_DIMENSION || height > MAX_DIMENSION
                        || (long) width * height > MAX_PIXELS) {
                    throw new Rejected("Foto grande demais: até " + MAX_PIXELS / 1_000_000 + " megapixels e "
                            + MAX_DIMENSION + " px de lado.");
                }
                int orientation = format.equals("jpeg") ? exifOrientation(reader.getImageMetadata(0)) : 1;
                ImageReadParam param = reader.getDefaultReadParam();
                // fotos enormes já saem do decodificador reduzidas (memória proporcional à saída, não ao original)
                int step = Math.max(1, (fit.square ? Math.min(width, height) : Math.max(width, height)) / fit.side);
                if (step > 1) {
                    param.setSourceSubsampling(step, step, 0, 0);
                }
                BufferedImage decoded = reader.read(0, param);
                // o recorte central é o mesmo em qualquer orientação: recorta e reduz antes de girar (menos pixels)
                BufferedImage framed = fit.square ? centerSquare(decoded) : decoded;
                return encode(orient(fit(framed, fit.side), orientation));
            } finally {
                reader.dispose();
            }
        } catch (IIOException | IllegalArgumentException e) {
            throw new Rejected("Não foi possível ler a foto. Exporte de novo em JPEG ou PNG e tente outra vez.");
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    // ------------------------------------------------------------ pixels

    /** Redesenha numa imagem nova (sempre, mesmo sem reduzir) e reduz em passos de metade para não serrilhar. */
    static BufferedImage fit(BufferedImage src, int maxSide) {
        boolean alpha = src.getColorModel().hasAlpha();
        int type = alpha ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB;
        double scale = Math.min(1.0, (double) maxSide / Math.max(src.getWidth(), src.getHeight()));
        int targetW = Math.max(1, (int) Math.round(src.getWidth() * scale));
        int targetH = Math.max(1, (int) Math.round(src.getHeight() * scale));
        BufferedImage current = src;
        do {
            int w = current.getWidth() / 2 >= targetW ? current.getWidth() / 2 : targetW;
            int h = current.getHeight() / 2 >= targetH ? current.getHeight() / 2 : targetH;
            BufferedImage next = new BufferedImage(w, h, type);
            Graphics2D g = next.createGraphics();
            try {
                g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
                g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
                g.drawImage(current, 0, 0, w, h, null);
            } finally {
                g.dispose();
            }
            current = next;
        } while (current.getWidth() != targetW || current.getHeight() != targetH);
        return current;
    }

    static BufferedImage centerSquare(BufferedImage src) {
        int side = Math.min(src.getWidth(), src.getHeight());
        return src.getSubimage((src.getWidth() - side) / 2, (src.getHeight() - side) / 2, side, side);
    }

    /** Orientação EXIF 1–8 aplicada aos pixels; de 5 a 8 largura e altura trocam. */
    static BufferedImage orient(BufferedImage src, int orientation) {
        if (orientation <= 1 || orientation > 8) {
            return src;
        }
        int w = src.getWidth();
        int h = src.getHeight();
        boolean swap = orientation >= 5;
        BufferedImage out = new BufferedImage(swap ? h : w, swap ? w : h, src.getType());
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                int rgb = src.getRGB(x, y);
                switch (orientation) {
                    case 2 -> out.setRGB(w - 1 - x, y, rgb);
                    case 3 -> out.setRGB(w - 1 - x, h - 1 - y, rgb);
                    case 4 -> out.setRGB(x, h - 1 - y, rgb);
                    case 5 -> out.setRGB(y, x, rgb);
                    case 6 -> out.setRGB(h - 1 - y, x, rgb);
                    case 7 -> out.setRGB(h - 1 - y, w - 1 - x, rgb);
                    default -> out.setRGB(y, w - 1 - x, rgb);
                }
            }
        }
        return out;
    }

    private static CleanImage encode(BufferedImage img) throws IOException {
        boolean png = img.getColorModel().hasAlpha();
        ImageWriter writer = ImageIO.getImageWritersByFormatName(png ? "png" : "jpeg").next();
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ImageOutputStream out = new MemoryCacheImageOutputStream(bytes)) {
            writer.setOutput(out);
            ImageWriteParam param = writer.getDefaultWriteParam();
            if (!png) {
                param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
                param.setCompressionQuality(JPEG_QUALITY);
            }
            // metadados nulos: o gravador escreve só o mínimo do formato (JFIF ou IHDR), nada do arquivo original
            writer.write(null, new IIOImage(img, null, null), param);
        } finally {
            writer.dispose();
        }
        return new CleanImage(bytes.toByteArray(), png ? "image/png" : "image/jpeg", png ? "png" : "jpg",
                img.getWidth(), img.getHeight());
    }

    // ------------------------------------------------------------ EXIF

    /** Procura o APP1 "Exif" na árvore de metadados do JPEG; qualquer coisa estranha vale como "sem rotação". */
    static int exifOrientation(IIOMetadata metadata) {
        if (metadata == null) {
            return 1;
        }
        Node root = metadata.getAsTree("javax_imageio_jpeg_image_1.0");
        for (Node seq = root.getFirstChild(); seq != null; seq = seq.getNextSibling()) {
            if (!"markerSequence".equals(seq.getNodeName())) {
                continue;
            }
            for (Node m = seq.getFirstChild(); m != null; m = m.getNextSibling()) {
                Node tag = m.getAttributes() == null ? null : m.getAttributes().getNamedItem("MarkerTag");
                if ("unknown".equals(m.getNodeName()) && tag != null && Integer.parseInt(tag.getNodeValue()) == APP1
                        && m instanceof IIOMetadataNode node
                        && node.getUserObject() instanceof byte[] data) {
                    int o = orientationFromApp1(data);
                    if (o != 1) {
                        return o;
                    }
                }
            }
        }
        return 1;
    }

    /** {@code "Exif\0\0"} + cabeçalho TIFF; lê a tag 0x0112 (Orientation) do IFD0. */
    static int orientationFromApp1(byte[] app1) {
        try {
            if (app1.length < 14 || !new String(app1, 0, 4, StandardCharsets.US_ASCII).equals("Exif")) {
                return 1;
            }
            ByteBuffer tiff = ByteBuffer.wrap(app1, 6, app1.length - 6).slice();
            if (tiff.get(0) == 'I' && tiff.get(1) == 'I') {
                tiff.order(ByteOrder.LITTLE_ENDIAN);
            } else if (tiff.get(0) != 'M' || tiff.get(1) != 'M') {
                return 1;
            }
            if (tiff.getShort(2) != 42) {
                return 1;
            }
            int ifd = tiff.getInt(4);
            int entries = tiff.getShort(ifd) & 0xFFFF;
            for (int i = 0; i < entries; i++) {
                int entry = ifd + 2 + i * 12;
                if ((tiff.getShort(entry) & 0xFFFF) == 0x0112) {
                    int value = tiff.getShort(entry + 8) & 0xFFFF;
                    return value >= 1 && value <= 8 ? value : 1;
                }
            }
            return 1;
        } catch (IndexOutOfBoundsException e) {
            return 1;
        }
    }
}
