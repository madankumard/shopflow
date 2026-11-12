# ShopFlow

Order and inventory management system, built as an end-to-end learning project.

## Layout

- `backend/` — Spring Boot 4 (Java 25, Maven wrapper), package root `com.shopflow`, one sub-package per feature (e.g. `product`).
- `frontend/` — Angular 22 (standalone components, signals, Vitest), one folder per feature under `src/app/` (e.g. `products`).
- `config-server/` — Spring Cloud Config Server (own Maven project); serves each environment's settings from the separate public repo `madankumard/shopflow-config` (cloned locally at `..\shopflow-config`).
- `docker-compose.yml` — local stack: Postgres 18, backend, and frontend served by nginx.
- `infra/kind/` — one kind cluster definition per environment (dev, qa, preprod, prod); each cluster stands in for a separate server.
- `infra/k8s/` — kustomize manifests: `base/` holds what all environments share, `overlays/<env>/` only what differs.
- `infra/*.ps1` — scripts to create the clusters, deploy a tag, smoke-test an environment and start the CI runner.
- `.github/workflows/ci.yml` — tests and image builds on every pull request; on `main` it also publishes images to `ghcr.io/madankumard` and promotes them dev → qa → preprod → prod.

## Commands

- Backend tests: `cd backend; .\mvnw.cmd test` (Docker must be running; integration tests start Postgres through Testcontainers).
- Frontend tests: `cd frontend; npx ng test --watch=false`
- Whole stack in containers: `docker compose up -d --build`, then open http://localhost:4200
- Create the four clusters (safe to re-run): `.\infra\create-clusters.ps1`
- Deploy by hand: `.\infra\deploy.ps1 -Environment dev -Tag <7-char commit>`, then `.\infra\smoke-test.ps1 -Environment dev`
- Environment URLs: dev http://localhost:8081, qa :8082, preprod :8083, prod :8084. kubectl contexts are `kind-shopflow-<env>`, namespace `shopflow`.
- After a Windows restart: start Docker Desktop, then `.\infra\start-runner.ps1` (the self-hosted runner lives in `%USERPROFILE%\actions-runner`).
- Change a setting in one environment: edit `backend-<env>.yml` in the `shopflow-config` repo, push, then `.\infra\reload-config.ps1 -Environment <env>`. No image is rebuilt.
- Config Server tests: `cd config-server; .\mvnw.cmd test`
- Day-to-day development: `docker compose up -d db`, then `cd backend; .\mvnw.cmd spring-boot:run` and `cd frontend; npx ng serve` (the dev server proxies `/api` to port 8080).

## Conventions

- Schema changes go in a new Flyway file `backend/src/main/resources/db/migration/V<n>__<name>.sql`; never edit an applied migration. Hibernate only validates the schema.
- Controllers take and return record DTOs (`*Request`, `*Response`), never entities.
- Each backend feature needs a `@WebMvcTest` unit test and a `@SpringBootTest` integration test against real Postgres.
- Each Angular component needs a spec that covers its loading, empty and error states where it has them.
- The frontend always calls relative `/api/...` URLs; the dev proxy or nginx routes them to the backend.
- Environment-specific values are never hard-coded: read them from `${ENV_VAR:local-default}` in `application.properties`.
- The JVM runs in UTC (Postgres rejects the legacy `Asia/Calcutta` zone name that Windows reports).
- Always use `.\mvnw.cmd`; the system Maven (3.6.3) is too old.
- `main` is protected: work on a branch and merge through a pull request once the three CI checks pass. Pre-prod and prod deployments wait for a manual approval in GitHub.
- Ordinary per-environment settings go in the `shopflow-config` repo (`backend.yml` shared, `backend-<env>.yml` per environment); never bake them into an image, and never put a secret there. The overlays in `infra/k8s/overlays/<env>/` hold only the Spring profile and replica counts.
- Secrets reach the backend through Vault (`secret/backend`, Kubernetes login as service account `backend`). Vault runs in dev mode: it is re-seeded on every start by `infra/k8s/base/vault/seed.sh` from the per-cluster `shopflow-db` Secret, which is generated once and never committed.
- Locally and in tests the Config Server and Vault clients are off (`CONFIG_SERVER_ENABLED`, `VAULT_ENABLED` default to false) and the defaults in `application.properties` apply.
- Infra scripts must run on Windows PowerShell 5.1 (the runner uses it): ASCII only, no `&&`, no ternaries.

## Roadmap

1. Backend + frontend skeletons, local stack (done)
2. GitHub repo, CI with tests, self-hosted runner (done; automated AI review on pull requests deferred)
3. Four `kind` clusters (dev, QA, pre-prod, prod) with promotion pipeline (done)
4. Spring Cloud Config Server + Vault for per-environment configuration and secrets (dev-mode Vault first; production-mode Vault in pre-prod and prod to follow)
5. Auth (Keycloak), orders workflow, reports, Playwright end-to-end tests
6. Replicated Postgres in pre-prod and prod (CloudNativePG operator): a primary with a streaming standby, automatic failover, and backups; dev and QA keep a single instance
