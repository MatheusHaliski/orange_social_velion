#!/bin/sh
# Inicializa o layout do Garage e cria o bucket de mídias para desenvolvimento.
# Idempotente: pode rodar várias vezes.
set -eu

export GARAGE_RPC_HOST=garage:3901
BUCKET="${S3_BUCKET:-orange-social-media}"
KEY_NAME="orange-dev"

node_id=$(garage node id -q 2>/dev/null | cut -d@ -f1)

if ! garage layout show 2>/dev/null | grep -q "$node_id"; then
  garage layout assign -z dc1 -c 1G "$node_id"
  garage layout apply --version 1
fi

garage bucket info "$BUCKET" >/dev/null 2>&1 || garage bucket create "$BUCKET"

if ! garage key info "$KEY_NAME" >/dev/null 2>&1; then
  # Access key / secret fixos para o application.yml de desenvolvimento.
  garage key import --yes -n "$KEY_NAME" \
    GK0000000000000000orangedev \
    0000000000000000000000000000000000000000000000000000000000orangedev
fi

garage bucket allow --read --write --owner "$BUCKET" --key "$KEY_NAME"
echo "Garage pronto: bucket=$BUCKET endpoint=http://localhost:3900"
