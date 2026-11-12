#!/bin/sh
# Runs inside the Vault pod each time it starts.
#
# Vault runs here in dev mode, which keeps everything in memory, so a restart wipes it.
# This script puts back what the backend needs: the Kubernetes login, the backend's
# policy and role, and the database credentials (copied from the cluster's shopflow-db
# Secret, which stays the source of truth while Vault is in dev mode).
set -e

until vault status >/dev/null 2>&1; do
  sleep 1
done

# Let pods log in with their Kubernetes service account.
vault auth enable kubernetes 2>/dev/null || true
vault write auth/kubernetes/config \
  kubernetes_host="https://${KUBERNETES_SERVICE_HOST}:${KUBERNETES_SERVICE_PORT}" >/dev/null

# What the backend may read, and which service account counts as the backend.
vault policy write backend /vault/seed/backend-policy.hcl >/dev/null
vault write auth/kubernetes/role/backend \
  bound_service_account_names=backend \
  bound_service_account_namespaces=shopflow \
  token_policies=backend \
  token_ttl=1h >/dev/null

# Spring reads every key under secret/backend as a property of the same name.
vault kv put secret/backend \
  spring.datasource.username="${DB_USERNAME}" \
  spring.datasource.password="${DB_PASSWORD}" >/dev/null

echo "vault seeded"
