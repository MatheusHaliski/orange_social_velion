package com.orangesocial.support;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.zip.CRC32;

/** Fotos de teste montadas byte a byte: JPEG com EXIF "de celular", PNG com transparência e cabeçalhos falsos. */
public final class TestImages {

    /** Texto gravado no EXIF; não pode sobrar nada dele na foto publicada. */
    public static final String EXIF_SECRET = "GPS -25.4284 -49.2733 · iPhone da Ana";

    private TestImages() {
    }

    /** Metade esquerda vermelha, direita azul; EXIF com Orientation e ImageDescription. */
    public static byte[] jpegWithExif(int width, int height, int orientation) {
        BufferedImage img = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(Color.RED);
        g.fillRect(0, 0, width / 2, height);
        g.setColor(Color.BLUE);
        g.fillRect(width / 2, 0, width - width / 2, height);
        g.dispose();
        byte[] jpeg = write(img, "jpeg");
        int app0End = 4 + (((jpeg[4] & 0xFF) << 8) | (jpeg[5] & 0xFF));   // SOI + APP0 do JFIF
        byte[] app1 = exifSegment(orientation);
        ByteBuffer out = ByteBuffer.allocate(jpeg.length + app1.length);
        out.put(jpeg, 0, app0End).put(app1).put(jpeg, app0End, jpeg.length - app0End);
        return out.array();
    }

    public static byte[] png(int width, int height, boolean alpha) {
        BufferedImage img = new BufferedImage(width, height, alpha ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(alpha ? new Color(255, 106, 43, 128) : new Color(255, 106, 43));
        g.fillRect(0, 0, width, height);
        g.dispose();
        return write(img, "png");
    }

    /** Só a assinatura e o IHDR de um PNG enorme: o tamanho declarado basta para recusar sem decodificar. */
    public static byte[] pngHeaderOnly(int width, int height) {
        ByteBuffer ihdr = ByteBuffer.allocate(13).putInt(width).putInt(height)
                .put((byte) 8).put((byte) 2).put((byte) 0).put((byte) 0).put((byte) 0);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.writeBytes(new byte[]{(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'});
        out.writeBytes(chunk("IHDR", ihdr.array()));
        out.writeBytes(chunk("IEND", new byte[0]));
        return out.toByteArray();
    }

    /** APP1 "Exif" com TIFF big-endian: IFD0 com ImageDescription (0x010E) e Orientation (0x0112). */
    static byte[] exifSegment(int orientation) {
        byte[] text = (EXIF_SECRET + "\0").getBytes(StandardCharsets.UTF_8);
        int textOffset = 8 + 2 + 2 * 12 + 4;
        ByteBuffer tiff = ByteBuffer.allocate(textOffset + text.length)
                .put((byte) 'M').put((byte) 'M').putShort((short) 42).putInt(8)
                .putShort((short) 2)
                .putShort((short) 0x010E).putShort((short) 2).putInt(text.length).putInt(textOffset)
                .putShort((short) 0x0112).putShort((short) 3).putInt(1).putShort((short) orientation).putShort((short) 0)
                .putInt(0)
                .put(text);
        byte[] payload = ByteBuffer.allocate(6 + tiff.capacity()).put("Exif\0\0".getBytes(StandardCharsets.US_ASCII))
                .put(tiff.array()).array();
        return ByteBuffer.allocate(4 + payload.length).put((byte) 0xFF).put((byte) 0xE1)
                .putShort((short) (2 + payload.length)).put(payload).array();
    }

    private static byte[] chunk(String type, byte[] data) {
        byte[] name = type.getBytes(StandardCharsets.US_ASCII);
        CRC32 crc = new CRC32();
        crc.update(name);
        crc.update(data);
        return ByteBuffer.allocate(12 + data.length).putInt(data.length).put(name).put(data)
                .putInt((int) crc.getValue()).array();
    }

    private static byte[] write(BufferedImage img, String format) {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(img, format, out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
