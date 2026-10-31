#!/bin/sh
# Inicializa o Garage de desenvolvimento pela Admin API v2 (a imagem do Garage não tem shell):
# layout de nó único, dois buckets e a chave de acesso do perfil dev:
#   - mídias (público, s3_web): só versões limpas (posts/, avatars/, backgrounds/);
#   - uploads (PRIVADO): originais enviados pelo app em uploads/, com EXIF/GPS e dono ainda não conferido.
# Depois, pela API S3: os originais expiram em 1 dia e o CORS libera o PUT do app web no bucket de uploads.
# Idempotente: pode rodar várias vezes. Os testes de integração fazem o mesmo em support/GarageContainer.java.
set -eu

ADMIN="${GARAGE_ADMIN_URL:-http://garage:3903}"
S3="${GARAGE_S3_URL:-http://garage:3900}"
WEB_ORIGIN="${WEB_ORIGIN:-http://localhost:3000}"
TOKEN="${GARAGE_ADMIN_TOKEN:-orange-dev-admin-token}"
BUCKET="${S3_BUCKET:-orange-social-media}"
UPLOADS_BUCKET="${S3_UPLOADS_BUCKET:-orange-social-uploads}"
# Chave pública de desenvolvimento (a mesma do application-dev.yml); nunca use fora da máquina local.
ACCESS_KEY="GK6f72616e6765646576000000"
SECRET_KEY="6f72616e67652d736f6369616c2d6465762d6f6e6c7900000000000000000000"

api() {
  method=$1; path=$2; shift 2
  curl -fsS -X "$method" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" "$ADMIN$path" "$@"
}
s3() {
  method=$1; bucket=$2; query=$3; body=$4
  curl -fsS -o /dev/null --aws-sigv4 "aws:amz:sa-east-1:s3" --user "$ACCESS_KEY:$SECRET_KEY" -X "$method" \
    -H "Content-Type: application/xml" --data "$body" "$S3/$bucket?$query"
}
field() { tr -d ' \n' | sed -n "s/^{\"$1\":\"\{0,1\}\([0-9a-f]*\).*/\1/p"; }

if [ "$(api GET /v2/GetClusterLayout | field version)" = "0" ]; then
  node_id=$(api GET /v2/GetClusterStatus | tr -d ' \n' | sed -n 's/.*"nodes":\[{"id":"\([0-9a-f]*\)".*/\1/p')
  api POST /v2/UpdateClusterLayout \
    -d "{\"roles\":[{\"id\":\"$node_id\",\"zone\":\"dc1\",\"capacity\":1000000000,\"tags\":[]}]}" >/dev/null
  api POST /v2/ApplyClusterLayout -d '{"version":1}' >/dev/null
fi

api GET "/v2/GetKeyInfo?id=$ACCESS_KEY" >/dev/null 2>&1 \
  || api POST /v2/ImportKey \
       -d "{\"name\":\"orange-dev\",\"accessKeyId\":\"$ACCESS_KEY\",\"secretAccessKey\":\"$SECRET_KEY\"}" >/dev/null

bucket_id() {
  api GET "/v2/GetBucketInfo?globalAlias=$1" >/dev/null 2>&1 \
    || api POST /v2/CreateBucket -d "{\"globalAlias\":\"$1\"}" >/dev/null
  id=$(api GET "/v2/GetBucketInfo?globalAlias=$1" | field id)
  api POST /v2/AllowBucketKey \
    -d "{\"bucketId\":\"$id\",\"accessKeyId\":\"$ACCESS_KEY\",\"permissions\":{\"read\":true,\"write\":true,\"owner\":true}}" >/dev/null
  echo "$id"
}
media_id=$(bucket_id "$BUCKET")
uploads_id=$(bucket_id "$UPLOADS_BUCKET")

# só o bucket de mídias tem leitura pública; o de uploads continua privado (desliga se alguém ligou antes)
api POST "/v2/UpdateBucket?id=$media_id" \
  -d '{"websiteAccess":{"enabled":true,"indexDocument":"index.html"}}' >/dev/null
api POST "/v2/UpdateBucket?id=$uploads_id" -d '{"websiteAccess":{"enabled":false}}' >/dev/null

# o que ninguém publicou some sozinho (a foto limpa vai para posts/ ou avatars/ no bucket de mídias)
s3 PUT "$UPLOADS_BUCKET" lifecycle '<LifecycleConfiguration><Rule><ID>uploads-24h</ID><Status>Enabled</Status><Filter><Prefix>uploads/</Prefix></Filter><Expiration><Days>1</Days></Expiration><AbortIncompleteMultipartUpload><DaysAfterInitiation>1</DaysAfterInitiation></AbortIncompleteMultipartUpload></Rule></LifecycleConfiguration>'
# o app web manda o PUT direto ao bucket de uploads e lê as mídias limpas do público
s3 PUT "$UPLOADS_BUCKET" cors "<CORSConfiguration><CORSRule><AllowedOrigin>$WEB_ORIGIN</AllowedOrigin><AllowedMethod>PUT</AllowedMethod><AllowedHeader>*</AllowedHeader><ExposeHeader>ETag</ExposeHeader><MaxAgeSeconds>3600</MaxAgeSeconds></CORSRule></CORSConfiguration>"
s3 PUT "$BUCKET" cors "<CORSConfiguration><CORSRule><AllowedOrigin>$WEB_ORIGIN</AllowedOrigin><AllowedMethod>GET</AllowedMethod><AllowedHeader>*</AllowedHeader><MaxAgeSeconds>3600</MaxAgeSeconds></CORSRule></CORSConfiguration>"

echo "Garage pronto: mídias=$BUCKET (público) uploads=$UPLOADS_BUCKET (privado) S3=http://localhost:3900 leitura=http://$BUCKET.web.garage.localhost:3902"
