# Build stage
FROM node:26 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx ng build

# Runtime stage: nginx serves the static files and proxies /api to the backend.
FROM nginx:1.29-alpine
ENV BACKEND_URL=http://backend:8080
ENV KEYCLOAK_URL=http://keycloak:8080
# The nginx image substitutes these two environment variables in the template at start-up.
ENV NGINX_ENVSUBST_FILTER="^(BACKEND|KEYCLOAK)_URL$"
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
EXPOSE 80
