package com.orangesocial.application.media;

import com.orangesocial.application.media.ImageSanitizer.CleanImage;
import com.orangesocial.support.TestImages;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** RF29 · foto publicada sem EXIF/GPS, na orientação certa, reduzida e sem decodificar "bombas". */
class ImageSanitizerTest {

    @Test
    void stripsExifAndAppliesItsOrientation() throws IOException {
        byte[] original = TestImages.jpegWithExif(40, 20, 6);
        assertThat(contains(original, "Exif")).isTrue();
        assertThat(contains(original, TestImages.EXIF_SECRET)).isTrue();

        CleanImage clean = ImageSanitizer.sanitize(original);
        assertThat(clean.contentType()).isEqualTo("image/jpeg");
        assertThat(contains(clean.bytes(), "Exif")).isFalse();
        assertThat(contains(clean.bytes(), "GPS")).isFalse();
        assertThat(contains(clean.bytes(), TestImages.EXIF_SECRET)).isFalse();

        // Orientation 6 = girar 90° no sentido horário: a metade esquerda (vermelha) vai para cima
        BufferedImage img = ImageIO.read(new ByteArrayInputStream(clean.bytes()));
        assertThat(img.getWidth()).isEqualTo(20);
        assertThat(img.getHeight()).isEqualTo(40);
        assertThat(clean.width()).isEqualTo(20);
        assertThat(red(img, 10, 5)).isGreaterThan(200);
        assertThat(img.getRGB(10, 35) & 0xFF).isGreaterThan(200);
    }

    @Test
    void everyOrientationLandsTheLeftHalfWhereExpected() throws IOException {
        // onde a metade vermelha (esquerda no arquivo) aparece depois de aplicar cada orientação EXIF
        String[] expected = {null, "esquerda", "direita", "direita", "esquerda", "topo", "topo", "base", "base"};
        for (int o = 1; o <= 8; o++) {
            BufferedImage img = ImageIO.read(new ByteArrayInputStream(
                    ImageSanitizer.sanitize(TestImages.jpegWithExif(40, 20, o)).bytes()));
            int w = img.getWidth();
            int h = img.getHeight();
            int[] probe = switch (expected[o]) {
                case "esquerda" -> new int[]{3, h / 2};
                case "direita" -> new int[]{w - 4, h / 2};
                case "topo" -> new int[]{w / 2, 3};
                default -> new int[]{w / 2, h - 4};
            };
            assertThat(red(img, probe[0], probe[1])).as("orientação %d", o).isGreaterThan(200);
        }
    }

    @Test
    void shrinksTheLongestSideAndKeepsTransparencyAsPng() throws IOException {
        CleanImage big = ImageSanitizer.sanitize(TestImages.png(4500, 1500, false));
        assertThat(big.contentType()).isEqualTo("image/jpeg");
        assertThat(big.width()).isEqualTo(ImageSanitizer.MAX_SIDE);
        assertThat(big.height()).isEqualTo(683);

        CleanImage alpha = ImageSanitizer.sanitize(TestImages.png(64, 32, true));
        assertThat(alpha.contentType()).isEqualTo("image/png");
        assertThat(alpha.extension()).isEqualTo("png");
        BufferedImage img = ImageIO.read(new ByteArrayInputStream(alpha.bytes()));
        assertThat(img.getColorModel().hasAlpha()).isTrue();
        assertThat(img.getRGB(5, 5) >>> 24).isBetween(120, 136);
    }

    @Test
    void refusesWhatIsNotJpegOrPngAndHugeImagesBeforeDecoding() throws IOException {
        assertThatThrownBy(() -> ImageSanitizer.sanitize("<?php echo 1; ?>".getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(ImageSanitizer.Rejected.class).hasMessageContaining("JPEG ou PNG");
        byte[] gif = gif();
        assertThatThrownBy(() -> ImageSanitizer.sanitize(gif))
                .isInstanceOf(ImageSanitizer.Rejected.class).hasMessageContaining("JPEG ou PNG");
        // 20 000 × 20 000 = 400 MP declarados num arquivo de poucos bytes
        assertThatThrownBy(() -> ImageSanitizer.sanitize(TestImages.pngHeaderOnly(20_000, 20_000)))
                .isInstanceOf(ImageSanitizer.Rejected.class).hasMessageContaining("grande demais");
        byte[] truncated = Arrays.copyOf(TestImages.png(300, 300, false), 120);
        assertThatThrownBy(() -> ImageSanitizer.sanitize(truncated)).isInstanceOf(ImageSanitizer.Rejected.class);
    }

    @Test
    void exifParserReadsBothByteOrdersAndIgnoresGarbage() {
        ByteBuffer le = ByteBuffer.allocate(6 + 8 + 2 + 12 + 4).order(ByteOrder.LITTLE_ENDIAN);
        le.put("Exif\0\0".getBytes(StandardCharsets.US_ASCII)).put((byte) 'I').put((byte) 'I').putShort((short) 42)
                .putInt(8).putShort((short) 1)
                .putShort((short) 0x0112).putShort((short) 3).putInt(1).putShort((short) 3).putShort((short) 0)
                .putInt(0);
        assertThat(ImageSanitizer.orientationFromApp1(le.array())).isEqualTo(3);

        assertThat(ImageSanitizer.orientationFromApp1("Exif\0\0MM".getBytes(StandardCharsets.US_ASCII))).isEqualTo(1);
        assertThat(ImageSanitizer.orientationFromApp1(new byte[64])).isEqualTo(1);
        byte[] badOffset = le.array().clone();
        badOffset[10] = 0x7F;                                  // IFD0 aponta para fora do segmento
        assertThat(ImageSanitizer.orientationFromApp1(badOffset)).isEqualTo(1);
    }

    private static int red(BufferedImage img, int x, int y) {
        return (img.getRGB(x, y) >> 16) & 0xFF;
    }

    private static byte[] gif() throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(8, 8, BufferedImage.TYPE_BYTE_INDEXED), "gif", out);
        return out.toByteArray();
    }

    private static boolean contains(byte[] haystack, String needle) {
        return new String(haystack, StandardCharsets.ISO_8859_1).contains(
                new String(needle.getBytes(StandardCharsets.UTF_8), StandardCharsets.ISO_8859_1));
    }
}
