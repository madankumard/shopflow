# ShopFlow

Order and inventory management system, built as an end-to-end learning project.

## Layout

- `backend/` — Spring Boot 4 (Java 25, Maven wrapper), package root `com.shopflow`, one sub-package per feature (e.g. `product`).
- `frontend/` — Angular 22 (standalone components, signals, Vitest), one folder per feature under `src/app/` (e.g. `products`).
- `config-server/` — Spring Cloud Config Server (own Maven project); serves each environment's settings from the separate public repo `madankumard/shopflow-config` (cloned locally at `..\shopflow-config`).
- `e2e/` — Playwright browser tests (own npm project) that walk the main journeys against a deployed environment.
- `docker-compose.yml` — local stack: Postgres 18, Keycloak, backend, and frontend served by nginx.
- `infra/kind/` — one kind cluster definition per environment (dev, qa, preprod, prod); each cluster stands in for a separate server.
- `infra/k8s/` — kustomize manifests: `base/` holds what all environments share, `overlays/<env>/` only what differs.
- `infra/*.ps1` — scripts to create the clusters, deploy a tag, smoke-test an environment, show its test logins, reload its settings, remove unused images and start the CI runner.
- `.github/workflows/ci.yml` — tests and image builds on every pull request; on `main` it also publishes images to `ghcr.io/madankumard` and promotes them dev → qa → browser tests on qa → preprod → prod.

## Commands

- Backend tests: `cd backend; .\mvnw.cmd test` (Docker must be running; integration tests start Postgres through Testcontainers).
- Frontend tests: `cd frontend; npx ng test --watch=false`
- Whole stack in containers: `docker compose up -d --build`, then open http://localhost:4200
- Create the four clusters (safe to re-run): `.\infra\create-clusters.ps1`
- Deploy by hand: `.\infra\deploy.ps1 -Environment dev -Tag <7-char commit>`, then `.\infra\smoke-test.ps1 -Environment dev`
- Environment URLs: dev http://localhost:8081, qa :8082, preprod :8083, prod :8084. kubectl contexts are `kind-shopflow-<env>`, namespace `shopflow`.
- After a Windows restart: start Docker Desktop, then `.\infra\start-runner.ps1` (the self-hosted runner lives in `%USERPROFILE%\actions-runner`).
- Change a setting in one environment: edit `backend-<env>.yml` in the `shopflow-config` repo, push, then `.\infra\reload-config.ps1 -Environment <env>`. No image is rebuilt.
- Test logins for an environment (users `customer1`, `warehouse1`, `admin1`; passwords are generated per cluster): `.\infra\show-logins.ps1 -Environment dev`. In the local compose stack the password is `shopflow`.
- Browser tests against dev or qa (they place real orders, so never pre-prod or prod): `.\infra\e2e-test.ps1 -Environment dev`; add `-Headed` to watch. First use on a machine: `cd e2e; npm ci; npx playwright install chromium`. After a failure: `cd e2e; npx playwright show-report`.
- Free disk space by removing old image versions from the clusters (not during a deployment): `.\infra\prune-images.ps1`
- Config Server tests: `cd config-server; .\mvnw.cmd test`
- Day-to-day development: `docker compose up -d db keycloak`, then `cd backend; .\mvnw.cmd spring-boot:run` and `cd frontend; npx ng serve` (the dev server proxies `/api` to port 8080 and `/auth` to Keycloak on 8180).

## Conventions

- Schema changes go in a new Flyway file `backend/src/main/resources/db/migration/V<n>__<name>.sql`; never edit an applied migration. Hibernate only validates the schema.
- Controllers take and return record DTOs (`*Request`, `*Response`), never entities.
- Each backend feature needs a `@WebMvcTest` unit test and a `@SpringBootTest` integration test against real Postgres.
- Each Angular component needs a spec that covers its loading, empty and error states where it has them.
- The frontend always calls relative `/api/...` URLs; the dev proxy or nginx routes them to the backend.
- Environment-specific values are never hard-coded: read them from `${ENV_VAR:local-default}` in `application.properties`.
- The JVM runs in UTC (Postgres rejects the legacy `Asia/Calcutta` zone name that Windows reports).
- Always use `.\mvnw.cmd`; the system Maven (3.6.3) is too old.
- `main` is protected: work on a branch and merge through a pull request once the four CI checks pass. Pre-prod and prod deployments wait for a manual approval in GitHub.
- Ordinary per-environment settings go in the `shopflow-config` repo (`backend.yml` shared, `backend-<env>.yml` per environment); never bake them into an image, and never put a secret there. The overlays in `infra/k8s/overlays/<env>/` hold only the Spring profile and replica counts.
- Secrets reach the backend through Vault (`secret/backend`, Kubernetes login as service account `backend`). Vault runs in dev mode: it is re-seeded on every start by `infra/k8s/base/vault/seed.sh` from the per-cluster `shopflow-db` Secret, which is generated once and never committed.
- Locally and in tests the Config Server and Vault clients are off (`CONFIG_SERVER_ENABLED`, `VAULT_ENABLED` default to false) and the defaults in `application.properties` apply.
- Login is Keycloak (realm `shopflow`, roles `customer`, `warehouse`, `admin`, defined in `infra/k8s/base/keycloak/shopflow-realm.json`). Browsers reach it at `<app address>/auth` through the frontend's nginx; the backend only validates tokens. Keycloak runs in development mode and reloads that realm file on every start, so change users and roles in the file, not in the admin console.
- Access rules live in one place, `backend/.../security/SecurityConfig.java`: anything not explicitly opened there requires a login. Hiding a control in the frontend is a convenience, never the rule. Test each rule in the feature's `@WebMvcTest` (import `SecurityConfig`, mock `JwtDecoder`) for no login, wrong role and right role.
- Business rules that change several rows together (placing or cancelling an order and its stock) live in a `@Service` with `@Transactional` methods, not in the controller. Rows that a rule reads and then changes are loaded with a locking query such as `ProductRepository.findAllByIdForUpdate`.
- Totals and rankings are computed by the database (see `ReportRepository`), not by loading rows into the application. Tests of such figures share a database with other tests, so they assert the change their own data makes, never absolute numbers.
- A day sent to the frontend as `yyyy-mm-dd` is formatted with no timezone argument; adding one shifts it to the previous day east of Greenwich.
- A user must never learn that another user's record exists: return 404, not 403, for someone else's order.
- Frontend code gets the user from `AuthService`; component specs use `provideFakeAuth` from `src/app/auth/testing.ts`.
- A change to a screen a journey in `e2e/tests/journeys.spec.ts` walks through (login, catalogue, ordering, the Orders page) must keep that journey passing; add a journey only for a new end-to-end flow, and keep detail in the component specs. The journeys run in order and share data, and reuse one product, `E2E-001`, per environment.
- Files that run or are parsed inside Linux containers (`*.sh`, `*.hcl`, `*.json`) are pinned to LF in `.gitattributes`. Before trusting a manual cluster test, deploy from a fresh `git clone`: the runner checks out on Windows, and a working copy can hide line-ending problems.
- Infra scripts must run on Windows PowerShell 5.1 (the runner uses it): ASCII only, no `&&`, no ternaries.

## Roadmap

1. Backend + frontend skeletons, local stack (done)
2. GitHub repo, CI with tests, self-hosted runner (done; automated AI review on pull requests deferred)
3. Four `kind` clusters (dev, QA, pre-prod, prod) with promotion pipeline (done)
4. Spring Cloud Config Server + Vault for per-environment configuration and secrets (done; Vault stays in dev mode by choice, production-mode Vault was dropped)
5. Auth (Keycloak) with roles, orders workflow, Playwright end-to-end tests, admin reports (done)
