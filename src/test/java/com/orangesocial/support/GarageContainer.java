package com.orangesocial.support;

import com.github.dockerjava.api.command.InspectContainerResponse;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;
import org.testcontainers.utility.MountableFile;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Garage (API S3) dos testes de integração, com a mesma configuração do docker-compose ({@code infra/garage/garage.toml}).
 * A inicialização repete o {@code infra/garage/init.sh} pela Admin API v2: layout de nó único, bucket e a chave de
 * desenvolvimento. Idempotente, para funcionar com container reutilizado.
 */
public class GarageContainer extends GenericContainer<GarageContainer> {

    static final String IMAGE = "dxflrs/garage:v2.4.1";
    public static final String BUCKET = "orange-social-media";
    public static final String REGION = "sa-east-1";
    public static final String ACCESS_KEY = "GK6f72616e6765646576000000";
    public static final String SECRET_KEY = "6f72616e67652d736f6369616c2d6465762d6f6e6c7900000000000000000000";
    private static final String ADMIN_TOKEN = "orange-dev-admin-token";
    private static final Pattern FIRST_ID = Pattern.compile("\"id\"\\s*:\\s*\"([0-9a-f]+)\"");
    private static final Pattern VERSION = Pattern.compile("\"version\"\\s*:\\s*(\\d+)");

    private final HttpClient http = HttpClient.newHttpClient();

    public GarageContainer() {
        super(DockerImageName.parse(IMAGE));
        withCopyFileToContainer(MountableFile.forHostPath("infra/garage/garage.toml"), "/etc/garage.toml");
        withExposedPorts(3900, 3903);
        waitingFor(Wait.forLogMessage(".*Admin API server listening.*", 1));
    }

    public String s3Endpoint() {
        return "http://" + getHost() + ":" + getMappedPort(3900);
    }

    @Override
    protected void containerIsStarted(InspectContainerResponse info, boolean reused) {
        if (match(VERSION, admin("GET", "/v2/GetClusterLayout", null)).equals("0")) {
            String nodeId = match(FIRST_ID, admin("GET", "/v2/GetClusterStatus", null));
            admin("POST", "/v2/UpdateClusterLayout", "{\"roles\":[{\"id\":\"" + nodeId
                    + "\",\"zone\":\"dc1\",\"capacity\":1000000000,\"tags\":[]}]}");
            admin("POST", "/v2/ApplyClusterLayout", "{\"version\":1}");
        }
        if (status("/v2/GetBucketInfo?globalAlias=" + BUCKET) == 404) {
            admin("POST", "/v2/CreateBucket", "{\"globalAlias\":\"" + BUCKET + "\"}");
        }
        String bucketId = match(FIRST_ID, admin("GET", "/v2/GetBucketInfo?globalAlias=" + BUCKET, null));
        if (status("/v2/GetKeyInfo?id=" + ACCESS_KEY) == 404) {
            admin("POST", "/v2/ImportKey", "{\"name\":\"orange-it\",\"accessKeyId\":\"" + ACCESS_KEY
                    + "\",\"secretAccessKey\":\"" + SECRET_KEY + "\"}");
        }
        admin("POST", "/v2/AllowBucketKey", "{\"bucketId\":\"" + bucketId + "\",\"accessKeyId\":\"" + ACCESS_KEY
                + "\",\"permissions\":{\"read\":true,\"write\":true,\"owner\":true}}");
    }

    private String admin(String method, String path, String json) {
        HttpResponse<String> response = send(method, path, json);
        if (response.statusCode() / 100 != 2) {
            throw new IllegalStateException("Garage " + method + " " + path + " → " + response.statusCode() + ": "
                    + response.body());
        }
        return response.body();
    }

    private int status(String path) {
        return send("GET", path, null).statusCode();
    }

    private HttpResponse<String> send(String method, String path, String json) {
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://" + getHost() + ":" + getMappedPort(3903) + path))
                .header("Authorization", "Bearer " + ADMIN_TOKEN)
                .header("Content-Type", "application/json")
                .method(method, json == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(json))
                .build();
        try {
            return http.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }

    private static String match(Pattern pattern, String body) {
        Matcher m = pattern.matcher(body);
        if (!m.find()) {
            throw new IllegalStateException("Resposta inesperada do Garage: " + body);
        }
        return m.group(1);
    }
}
