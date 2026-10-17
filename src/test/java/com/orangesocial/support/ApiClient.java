package com.orangesocial.support;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClient;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Um "navegador" para os testes de integração: guarda os próprios cookies (sessão e XSRF-TOKEN) e manda o
 * cabeçalho X-XSRF-TOKEN nas escritas, como o app faria. Dois ApiClient = duas janelas que não compartilham
 * cookies (ex.: janela normal × aba anônima).
 */
public final class ApiClient {

    private final RestClient http;
    private final Map<String, String> cookies = new LinkedHashMap<>();

    public ApiClient(int port) {
        this.http = RestClient.builder()
                .baseUrl("http://localhost:" + port)
                .defaultStatusHandler(HttpStatusCode::isError, (req, res) -> { })   // os asserts olham o status
                .build();
    }

    public ResponseEntity<Map> get(String path) {
        return send(HttpMethod.GET, path, null);
    }

    public ResponseEntity<Map> post(String path, Object body) {
        return send(HttpMethod.POST, path, body);
    }

    public ResponseEntity<Map> send(HttpMethod method, String path, Object body) {
        if (method != HttpMethod.GET && !cookies.containsKey("XSRF-TOKEN")) {
            exchange(HttpMethod.GET, "/api/v1/auth/csrf", null, Map.class);
        }
        return exchange(method, path, body, Map.class);
    }

    public ResponseEntity<List> getList(String path) {
        return exchange(HttpMethod.GET, path, null, List.class);
    }

    public ResponseEntity<Map> login(String email, String password) {
        return post("/api/v1/auth/login", Map.of("email", email, "password", password));
    }

    public String cookie(String name) {
        return cookies.get(name);
    }

    public Map<String, String> cookies() {
        return cookies;
    }

    /** Último Set-Cookie bruto da sessão, para conferir os atributos (HttpOnly, sem Max-Age...). */
    public String lastSessionSetCookie;

    private <T> ResponseEntity<T> exchange(HttpMethod method, String path, Object body, Class<T> type) {
        RestClient.RequestBodySpec spec = http.method(method).uri(path);
        if (!cookies.isEmpty()) {
            spec.header(HttpHeaders.COOKIE, cookies.entrySet().stream()
                    .map(e -> e.getKey() + "=" + e.getValue()).collect(Collectors.joining("; ")));
        }
        if (cookies.containsKey("XSRF-TOKEN")) {
            spec.header("X-XSRF-TOKEN", cookies.get("XSRF-TOKEN"));
        }
        if (body != null) {
            spec.contentType(MediaType.APPLICATION_JSON).body(body);
        }
        ResponseEntity<T> response = spec.retrieve().toEntity(type);
        for (String setCookie : response.getHeaders().getOrEmpty(HttpHeaders.SET_COOKIE)) {
            String pair = setCookie.split(";", 2)[0];
            String name = pair.substring(0, pair.indexOf('='));
            String value = pair.substring(pair.indexOf('=') + 1);
            if (name.contains("session")) {
                lastSessionSetCookie = setCookie;
            }
            if (value.isEmpty() || setCookie.contains("Max-Age=0")) {
                cookies.remove(name);
            } else {
                cookies.put(name, value);
            }
        }
        return response;
    }
}
