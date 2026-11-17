#!/usr/bin/env bash
# Regression check for the service-proxy ads/dbm routing.
#   1. nginx starts and stays up while the ads and dbm services are down.
#   2. Once they come up, /services/ads/* and /services/dbm/* reach them with the prefix stripped.
# Uses stub containers for every upstream; needs only Docker.
set -euo pipefail

cd "$(dirname "$0")/.."

ID="nginx-check-$$"
NET="$ID-net"
IMAGE="${NGINX_CHECK_IMAGE:-storedog-nginx-check:local}"
STUB_IMAGE=nginx:1.28-alpine

cleanup() {
  docker rm -f "$ID-proxy" "$ID-others" "$ID-ads" "$ID-dbm" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*"
  docker logs "$ID-proxy" 2>&1 | tail -20 || true
  exit 1
}

# Stub upstream that answers "<name> <uri>" on the given ports.
start_stub() {
  local name=$1; shift
  local ports=("$@")
  local conf="" aliases=()
  for p in "${ports[@]}"; do
    conf+="server { listen $p; location / { default_type text/plain; return 200 \"$name \$request_uri\"; } } "
  done
  docker run -d --name "$ID-$name" --network "$NET" "${STUB_ALIASES[@]}" "$STUB_IMAGE" \
    sh -c "echo '$conf' > /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'" >/dev/null
}

proxy_get() {
  docker exec "$ID-others" wget -qO- "http://$ID-proxy$1" 2>/dev/null || true
}

if [ -z "${NGINX_CHECK_IMAGE:-}" ]; then
  echo "Building service-proxy image..."
  docker build -q -t "$IMAGE" . >/dev/null
fi

docker network create "$NET" >/dev/null

STUB_ALIASES=(--network-alias backend --network-alias discounts --network-alias frontend)
start_stub others 4000 2814 3000

docker run -d --name "$ID-proxy" --network "$NET" "$IMAGE" >/dev/null

echo "Check 1: nginx stays up with ads and dbm down"
sleep 5
[ "$(docker inspect -f '{{.State.Running}}' "$ID-proxy")" = "true" ] || fail "nginx exited while ads/dbm were down"
[[ "$(proxy_get /services/backend)" == "others /"* ]] || fail "backend route broken while ads was down"

echo "Check 2: ads and dbm are reachable once they start"
STUB_ALIASES=(--network-alias ads)
start_stub ads 3030
STUB_ALIASES=(--network-alias dbm)
start_stub dbm 7595

# nginx may cache the earlier failed lookup for up to the resolver's valid=30s.
ads="" dbm=""
for _ in $(seq 1 45); do
  ads=$(proxy_get "/services/ads/ads?x=1")
  dbm=$(proxy_get "/services/dbm/get-item?id=2")
  [ "$ads" = "ads /ads?x=1" ] && [ "$dbm" = "dbm /get-item?id=2" ] && break
  sleep 1
done
[ "$ads" = "ads /ads?x=1" ] || fail "/services/ads/ads?x=1 returned '$ads', expected 'ads /ads?x=1'"
[ "$dbm" = "dbm /get-item?id=2" ] || fail "/services/dbm/get-item?id=2 returned '$dbm', expected 'dbm /get-item?id=2'"
[ "$(proxy_get /services/ads)" = "ads /" ] || fail "/services/ads did not map to /"

echo "PASS: service-proxy starts with ads down and routes /services/ads and /services/dbm"
