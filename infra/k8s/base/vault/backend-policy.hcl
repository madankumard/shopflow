# The backend may read its own secrets and the ones shared by all applications; nothing else.
path "secret/data/backend" {
  capabilities = ["read"]
}

path "secret/data/backend/*" {
  capabilities = ["read"]
}

path "secret/data/application" {
  capabilities = ["read"]
}

path "secret/data/application/*" {
  capabilities = ["read"]
}
