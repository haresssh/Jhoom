# Stage 1: Build Frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend

# Install dependencies first (leverage caching)
COPY frontend/package*.json ./
RUN npm install

# Build static assets
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Backend
FROM maven:3.8.8-eclipse-temurin-17 AS backend-builder
WORKDIR /app/backend

# Copy pom.xml and download dependencies first
COPY backend/pom.xml ./
RUN mvn dependency:go-offline -B

# Copy source code
COPY backend/src ./src

# Copy built frontend assets from Stage 1 into backend resources static folder
COPY --from=frontend-builder /app/frontend/dist ./src/main/resources/static

# Package the application JAR
RUN mvn package -DskipTests -B

# Stage 3: Runtime
FROM eclipse-temurin:17-jre
WORKDIR /app

# Expose Spring Boot port
EXPOSE 8080

# Copy the compiled JAR
COPY --from=backend-builder /app/backend/target/backend-0.0.1-SNAPSHOT.jar app.jar

# Run Jhoom
ENTRYPOINT ["java", "-jar", "app.jar"]
