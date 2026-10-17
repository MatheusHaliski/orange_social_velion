package com.orangesocial.security;

import jakarta.servlet.http.HttpServletRequest;

import java.util.Locale;
import java.util.Set;

/**
 * O que o servidor guarda do cliente: IP só como HMAC (nunca em claro), um resumo do navegador para a lista de
 * sessões ("Chrome no Android") e o canal (WEB, IOS, ANDROID). O User-Agent completo não é guardado.
 */
public record ClientInfo(String ipHash, String device, String channel) {

    public static final String CHANNEL_HEADER = "X-Orange-Channel";
    private static final Set<String> CHANNELS = Set.of("WEB", "IOS", "ANDROID");

    public static ClientInfo from(HttpServletRequest request, AppSecrets secrets) {
        String channel = request.getHeader(CHANNEL_HEADER);
        channel = channel != null && CHANNELS.contains(channel.toUpperCase(Locale.ROOT))
                ? channel.toUpperCase(Locale.ROOT) : "WEB";
        return new ClientInfo(secrets.fingerprint("ip", request.getRemoteAddr()),
                describe(request.getHeader("User-Agent")), channel);
    }

    static String describe(String ua) {
        if (ua == null || ua.isBlank()) {
            return "Navegador desconhecido";
        }
        String browser = ua.contains("Edg/") ? "Edge" : ua.contains("Firefox/") ? "Firefox"
                : ua.contains("Chrome/") ? "Chrome" : ua.contains("Safari/") ? "Safari" : "Navegador";
        String os = ua.contains("Android") ? "Android" : (ua.contains("iPhone") || ua.contains("iPad")) ? "iOS"
                : ua.contains("Windows") ? "Windows" : ua.contains("Mac OS") ? "macOS"
                : ua.contains("Linux") ? "Linux" : "outro sistema";
        return browser + " no " + os;
    }
}
