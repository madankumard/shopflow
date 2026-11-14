# ShopFlow

Order and inventory management system, built as an end-to-end learning project.

## Layout

- `backend/` — Spring Boot 4 (Java 25, Maven wrapper), package root `com.shopflow`, one sub-package per feature (e.g. `product`).
- `frontend/` — Angular 22 (standalone components, signals, Vitest), one folder per feature under `src/app/` (e.g. `products`).
- `config-server/` — Spring Cloud Config Server (own Maven project); serves each environment's settings from the separate public repo `madankumard/shopflow-config` (cloned locally at `..\shopflow-config`).
- `e2e/` — Playwright browser tests (own npm project) that walk the main journeys against a deployed environment.
- `docker-compose.yml` — local stack: Postgres 18, Keycloak, backend, and frontend served by nginx.
- `infra/kind/` — one kind cluster definition per environment (dev, qa, preprod, prod); each cluster stands in for a separate server. Only dev exists at the moment (see "Environments" below).
- `infra/k8s/` — kustomize manifests: `base/` holds what all environments share, `overlays/<env>/` only what differs.
- `infra/*.ps1` — scripts to create the clusters, deploy a tag, smoke-test an environment, show its test logins, reload its settings, remove unused images, delete clusters and start the CI runner.
- `.github/workflows/ci.yml` — tests and image builds on every pull request; on `main` it also publishes images to `ghcr.io/madankumard`, deploys them to dev and runs the browser tests there.

## Commands

- Backend tests: `cd backend; .\mvnw.cmd test` (Docker must be running; integration tests start Postgres through Testcontainers).
- Frontend tests: `cd frontend; npx ng test --watch=false`
- Whole stack in containers: `docker compose up -d --build`, then open http://localhost:4200
- Create the active clusters, currently just dev (safe to re-run): `.\infra\create-clusters.ps1`
- Deploy by hand: `.\infra\deploy.ps1 -Environment dev -Tag <7-char commit>`, then `.\infra\smoke-test.ps1 -Environment dev`
- Environment URL: dev http://localhost:8081 (qa :8082, preprod :8083 and prod :8084 are reserved for when those clusters exist). kubectl contexts are `kind-shopflow-<env>`, namespace `shopflow`.
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
- `main` is protected: work on a branch and merge through a pull request once the four CI checks pass.
- Ordinary per-environment settings go in the `shopflow-config` repo (`backend.yml` shared, `backend-<env>.yml` per environment); never bake them into an image, and never put a secret there. The overlays in `infra/k8s/overlays/<env>/` hold only the Spring profile and replica counts.
- Secrets reach the backend through Vault (`secret/backend`, Kubernetes login as service account `backend`). Vault runs in dev mode: it is re-seeded on every start by `infra/k8s/base/vault/seed.sh` from the per-cluster `shopflow-db` Secret, which is generated once and never committed.
- Locally and in tests the Config Server and Vault clients are off (`CONFIG_SERVER_ENABLED`, `VAULT_ENABLED` default to false) and the defaults in `application.properties` apply.
- Login is Keycloak (realm `shopflow`, roles `customer`, `warehouse`, `admin`, defined in `infra/k8s/base/keycloak/shopflow-realm.json`). Browsers reach it at `<app address>/auth` through the frontend's nginx; the backend only validates tokens. Keycloak runs in development mode and reloads that realm file on every start, so change users and roles in the file, not in the admin console.
- The app has one address per environment, `http://localhost:<port>`. Keycloak's allowed redirect addresses and the backend's expected token issuer are both tied to it, so the frontend's nginx redirects a page opened by any other address (`127.0.0.1`, a hostname, a network IP) to `localhost`; `/api/` and `/auth/` are never redirected, and `/healthz` answers the readiness probe, which calls by pod IP. The `ng serve` dev server has no such redirect: open it as `http://localhost:4200`. Adding another address (a hostname, HTTPS) means changing all three: the realm file's `redirectUris`, the issuer in the config repo, and the nginx redirect.
- Access rules live in one place, `backend/.../security/SecurityConfig.java`: anything not explicitly opened there requires a login. Hiding a control in the frontend is a convenience, never the rule. Test each rule in the feature's `@WebMvcTest` (import `SecurityConfig`, mock `JwtDecoder`) for no login, wrong role and right role.
- Business rules that change several rows together (placing or cancelling an order and its stock) live in a `@Service` with `@Transactional` methods, not in the controller. Rows that a rule reads and then changes are loaded with a locking query such as `ProductRepository.findAllByIdForUpdate`.
- Totals and rankings are computed by the database (see `ReportRepository`), not by loading rows into the application. Tests of such figures share a database with other tests, so they assert the change their own data makes, never absolute numbers.
- A day sent to the frontend as `yyyy-mm-dd` is formatted with no timezone argument; adding one shifts it to the previous day east of Greenwich.
- A user must never learn that another user's record exists: return 404, not 403, for someone else's order.
- Primary controls are on screen from the first render and never appear after a delay: the header shows Log in until the start-up login check confirms a session. `AuthService.init()` never abandons that check; its time limit only ends the waits in route guards and in a Log in clicked early.
- Frontend code gets the user from `AuthService`; component specs use `provideFakeAuth` from `src/app/auth/testing.ts`.
- A change to a screen a journey in `e2e/tests/journeys.spec.ts` walks through (login, catalogue, ordering, the Orders page) must keep that journey passing; add a journey only for a new end-to-end flow, and keep detail in the component specs. The journeys run in order and share data, and reuse one product, `E2E-001`, per environment.
- Files that run or are parsed inside Linux containers (`*.sh`, `*.hcl`, `*.json`) are pinned to LF in `.gitattributes`. Before trusting a manual cluster test, deploy from a fresh `git clone`: the runner checks out on Windows, and a working copy can hide line-ending problems.
- Infra scripts must run on Windows PowerShell 5.1 (the runner uses it): ASCII only, no `&&`, no ternaries.

## Environments

Only the dev cluster exists. The qa, preprod and prod clusters were deleted on 2026-11-14 to free disk space and memory (each took 4 to 6 GB of disk and about 2.5 GB of memory), and their jobs were removed from the pipeline. Everything needed to bring them back is still in the repo: `infra/kind/<env>.yaml`, `infra/k8s/overlays/<env>/`, `backend-<env>.yml` in the config repo, and the GitHub environments `qa`, `preprod` and `prod` (the last two still require an approval).

Adding an environment back:

1. `.\infra\create-clusters.ps1 -Environment qa` creates the cluster with fresh secrets and an empty database.
2. Add it to `$ActiveEnvironments` in `infra/common.ps1`.
3. Add a deploy job for it to `.github/workflows/ci.yml`, modelled on `deploy-dev` and chained after it with `needs`. The commit "Deploy to dev only" removed the jobs that were there, including the manual-approval gates; `git show` on it gives the exact text to restore.
4. Never run the browser tests or any check that writes data against preprod or prod.

Deleting a cluster destroys its database for good: `.\infra\delete-clusters.ps1 -Environment <env>`.

## Roadmap

1. Backend + frontend skeletons, local stack (done)
2. GitHub repo, CI with tests, self-hosted runner (done; automated AI review on pull requests deferred)
3. Four `kind` clusters (dev, QA, pre-prod, prod) with promotion pipeline (done; later reduced to dev only to save space, see "Environments")
4. Spring Cloud Config Server + Vault for per-environment configuration and secrets (done; Vault stays in dev mode by choice, production-mode Vault was dropped)
5. Auth (Keycloak) with roles, orders workflow, Playwright end-to-end tests, admin reports (done)
