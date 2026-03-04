#!/bin/sh
set -eu

fail() {
  echo "[entrypoint] $1" >&2
  exit 1
}

trimmed_nas_ip=$(printf '%s' "${NAS_STATIC_IP:-}" | tr -d '[:space:]')

if [ -z "${trimmed_nas_ip}" ]; then
  fail "NAS_STATIC_IP is required for production gateway routing"
fi

if ! printf '%s' "${trimmed_nas_ip}" | grep -Eq '^([0-9]{1,3}\.){3}[0-9]{1,3}$'; then
  fail "NAS_STATIC_IP must be a valid IPv4 address"
fi

IFS='.'
set -- ${trimmed_nas_ip}
for octet in "$@"; do
  if [ "${octet}" -lt 0 ] || [ "${octet}" -gt 255 ]; then
    fail "NAS_STATIC_IP must be a valid IPv4 address"
  fi
done
unset IFS

BACKEND_UPSTREAM="http://${trimmed_nas_ip}:8080"
export BACKEND_UPSTREAM

envsubst '${BACKEND_UPSTREAM}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
