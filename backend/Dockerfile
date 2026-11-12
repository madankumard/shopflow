# Build stage
FROM eclipse-temurin:25-jdk AS build
WORKDIR /app
COPY .mvn .mvn
COPY mvnw pom.xml ./
COPY src src
# The cache mount keeps downloaded Maven dependencies between builds.
RUN --mount=type=cache,target=/root/.m2 \
    sed -i 's/\r$//' mvnw && chmod +x mvnw && ./mvnw -B -ntp package -DskipTests

# Runtime stage
FROM eclipse-temurin:25-jre
WORKDIR /app
RUN useradd --system --no-create-home app
COPY --from=build /app/target/backend-*.jar app.jar
USER app
# The commit this image was built from; CI passes it in. Declared last so it does not
# invalidate the cached layers above.
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
