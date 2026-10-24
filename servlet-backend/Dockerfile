# -----------------------------------------------------------------------------
# Stage 1: Build the deployable WAR artifact using Maven and Java 17
# -----------------------------------------------------------------------------
FROM maven:3.9-eclipse-temurin-17 AS builder

WORKDIR /app

# Copy pom.xml and source code only (excludes local build artifacts and secrets)
COPY pom.xml .
COPY src ./src

# Build the WAR file; fails the image build immediately if compilation or packaging fails
RUN mvn clean package -DskipTests

# -----------------------------------------------------------------------------
# Stage 2: Apache Tomcat 10.1 Runtime (Jakarta Servlet 6.0 compatible)
# -----------------------------------------------------------------------------
FROM tomcat:10.1-jdk17-temurin

WORKDIR /usr/local/tomcat

# Clean out default stock Tomcat web applications
RUN rm -rf webapps/*

# Deploy the compiled WAR as ROOT.war so endpoints are mapped at root context (e.g. /api/...)
COPY --from=builder /app/target/skillswap-servlet.war webapps/ROOT.war

# Informational port exposure (defaults to 8080 for local development)
EXPOSE 8080

# Configure Tomcat to listen on Render's dynamically assigned $PORT (defaults to 8080 if unset),
# then start Tomcat in the foreground
CMD ["sh", "-c", "sed -i \"s/port=\\\"8080\\\"/port=\\\"${PORT:-8080}\\\"/g\" conf/server.xml && bin/catalina.sh run"]
