#!/bin/sh
# Inicializa o Garage de desenvolvimento pela Admin API v2 (a imagem do Garage não tem shell):
# layout de nó único, bucket de mídias com leitura pública (s3_web) e a chave de acesso do perfil dev;
# depois, pela API S3: envios abandonados em uploads/ expiram em 1 dia e o CORS libera o PUT do app web.
# Idempotente: pode rodar várias vezes. Os testes de integração fazem o mesmo em support/GarageContainer.java.
set -eu

ADMIN="${GARAGE_ADMIN_URL:-http://garage:3903}"
S3="${GARAGE_S3_URL:-http://garage:3900}"
WEB_ORIGIN="${WEB_ORIGIN:-http://localhost:3000}"
TOKEN="${GARAGE_ADMIN_TOKEN:-orange-dev-admin-token}"
BUCKET="${S3_BUCKET:-orange-social-media}"
# Chave pública de desenvolvimento (a mesma do application-dev.yml); nunca use fora da máquina local.
ACCESS_KEY="GK6f72616e6765646576000000"
SECRET_KEY="6f72616e67652d736f6369616c2d6465762d6f6e6c7900000000000000000000"

api() {
  method=$1; path=$2; shift 2
  curl -fsS -X "$method" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" "$ADMIN$path" "$@"
}
s3() {
  method=$1; query=$2; body=$3
  curl -fsS -o /dev/null --aws-sigv4 "aws:amz:sa-east-1:s3" --user "$ACCESS_KEY:$SECRET_KEY" -X "$method" \
    -H "Content-Type: application/xml" --data "$body" "$S3/$BUCKET?$query"
}
field() { tr -d ' \n' | sed -n "s/^{\"$1\":\"\{0,1\}\([0-9a-f]*\).*/\1/p"; }

if [ "$(api GET /v2/GetClusterLayout | field version)" = "0" ]; then
  node_id=$(api GET /v2/GetClusterStatus | tr -d ' \n' | sed -n 's/.*"nodes":\[{"id":"\([0-9a-f]*\)".*/\1/p')
  api POST /v2/UpdateClusterLayout \
    -d "{\"roles\":[{\"id\":\"$node_id\",\"zone\":\"dc1\",\"capacity\":1000000000,\"tags\":[]}]}" >/dev/null
  api POST /v2/ApplyClusterLayout -d '{"version":1}' >/dev/null
fi

api GET "/v2/GetBucketInfo?globalAlias=$BUCKET" >/dev/null 2>&1 \
  || api POST /v2/CreateBucket -d "{\"globalAlias\":\"$BUCKET\"}" >/dev/null
bucket_id=$(api GET "/v2/GetBucketInfo?globalAlias=$BUCKET" | field id)

api GET "/v2/GetKeyInfo?id=$ACCESS_KEY" >/dev/null 2>&1 \
  || api POST /v2/ImportKey \
       -d "{\"name\":\"orange-dev\",\"accessKeyId\":\"$ACCESS_KEY\",\"secretAccessKey\":\"$SECRET_KEY\"}" >/dev/null
api POST /v2/AllowBucketKey \
  -d "{\"bucketId\":\"$bucket_id\",\"accessKeyId\":\"$ACCESS_KEY\",\"permissions\":{\"read\":true,\"write\":true,\"owner\":true}}" >/dev/null
api POST "/v2/UpdateBucket?id=$bucket_id" \
  -d '{"websiteAccess":{"enabled":true,"indexDocument":"index.html"}}' >/dev/null

# o que ninguém publicou some sozinho (a foto limpa vai para posts/ ou avatars/, que não expiram)
s3 PUT lifecycle '<LifecycleConfiguration><Rule><ID>uploads-24h</ID><Status>Enabled</Status><Filter><Prefix>uploads/</Prefix></Filter><Expiration><Days>1</Days></Expiration><AbortIncompleteMultipartUpload><DaysAfterInitiation>1</DaysAfterInitiation></AbortIncompleteMultipartUpload></Rule></LifecycleConfiguration>'
s3 PUT cors "<CORSConfiguration><CORSRule><AllowedOrigin>$WEB_ORIGIN</AllowedOrigin><AllowedMethod>PUT</AllowedMethod><AllowedMethod>GET</AllowedMethod><AllowedHeader>*</AllowedHeader><ExposeHeader>ETag</ExposeHeader><MaxAgeSeconds>3600</MaxAgeSeconds></CORSRule></CORSConfiguration>"

echo "Garage pronto: bucket=$BUCKET S3=http://localhost:3900 leitura=http://$BUCKET.web.garage.localhost:3902"
