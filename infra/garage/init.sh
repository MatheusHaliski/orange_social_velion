#!/bin/sh
# Inicializa o Garage de desenvolvimento pela Admin API v2 (a imagem do Garage não tem shell):
# layout de nó único, bucket de mídias com leitura pública (s3_web) e a chave de acesso do perfil dev.
# Idempotente: pode rodar várias vezes. Os testes de integração fazem o mesmo em support/GarageContainer.java.
set -eu

ADMIN="${GARAGE_ADMIN_URL:-http://garage:3903}"
TOKEN="${GARAGE_ADMIN_TOKEN:-orange-dev-admin-token}"
BUCKET="${S3_BUCKET:-orange-social-media}"
# Chave pública de desenvolvimento (a mesma do application-dev.yml); nunca use fora da máquina local.
ACCESS_KEY="GK6f72616e6765646576000000"
SECRET_KEY="6f72616e67652d736f6369616c2d6465762d6f6e6c7900000000000000000000"

api() {
  method=$1; path=$2; shift 2
  curl -fsS -X "$method" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" "$ADMIN$path" "$@"
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

echo "Garage pronto: bucket=$BUCKET S3=http://localhost:3900 leitura=http://$BUCKET.web.garage.localhost:3902"
