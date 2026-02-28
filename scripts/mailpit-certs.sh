#!/usr/bin/env bash
# Generate TLS certs for Mailpit (needed for PocketBase "Auto (StartTLS)")
# Prefer mkcert – creates locally trusted certs (PocketBase verifies TLS).
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)"
CERTS="$DIR/mailpit-certs"
mkdir -p "$CERTS"

if command -v mkcert >/dev/null 2>&1; then
  echo "Using mkcert (creates trusted certs)..."
  mkcert -install
  mkcert -key-file "$CERTS/key.pem" -cert-file "$CERTS/cert.pem" localhost 127.0.0.1
  echo "Created $CERTS/cert.pem and $CERTS/key.pem (trusted by system)"
else
  echo "Using openssl (self-signed). PocketBase will reject unless you add cert to trust store."
  echo "Install mkcert for trusted certs: https://github.com/FiloSottile/mkcert"
  openssl req -x509 -newkey rsa:4096 -nodes \
    -keyout "$CERTS/key.pem" -out "$CERTS/cert.pem" \
    -sha256 -days 3650 \
    -subj "/CN=localhost" \
    -addext "subjectAltName = DNS:localhost,IP:127.0.0.1"
  echo ""
  echo "To trust this cert on Linux, run:"
  echo "  sudo cp $CERTS/cert.pem /usr/local/share/ca-certificates/mailpit-dev.crt"
  echo "  sudo update-ca-certificates"
fi
