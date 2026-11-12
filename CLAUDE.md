# ShopFlow

Order and inventory management system, built as an end-to-end learning project.

## Layout

- `backend/` — Spring Boot 4 (Java 25, Maven wrapper), package root `com.shopflow`, one sub-package per feature (e.g. `product`).
- `frontend/` — Angular 22 (standalone components, signals, Vitest), one folder per feature under `src/app/` (e.g. `products`).
- `docker-compose.yml` — local stack: Postgres 18, backend, and frontend served by nginx.

## Commands

- Backend tests: `cd backend; .\mvnw.cmd test` (Docker must be running; integration tests start Postgres through Testcontainers).
- Frontend tests: `cd frontend; npx ng test --watch=false`
- Whole stack in containers: `docker compose up -d --build`, then open http://localhost:4200
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

## Roadmap

1. Backend + frontend skeletons, local stack (done)
2. GitHub repo, CI with tests and automated code review, self-hosted runner
3. Four `kind` clusters (dev, QA, pre-prod, prod) with promotion pipeline
4. Spring Cloud Config Server + Vault for per-environment configuration and secrets
5. Auth (Keycloak), orders workflow, reports, Playwright end-to-end tests
