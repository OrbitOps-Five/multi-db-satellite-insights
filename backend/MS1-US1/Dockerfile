# Stage 1: Build the app using Maven + Eclipse Temurin JDK
FROM maven:3.9.6-eclipse-temurin-17 AS build

# Set working directory
WORKDIR /app

# Copy only pom.xml first to cache dependencies
COPY pom.xml .
RUN mvn dependency:go-offline

# Now copy the entire source code
COPY src ./src

# Build the JAR file (skip tests to speed up build)
RUN mvn clean package -DskipTests

# Stage 2: Run the app with a lightweight JDK image
FROM eclipse-temurin:17-jdk

WORKDIR /app

# Copy the JAR file from the build stage
COPY --from=build /app/target/*.jar app.jar

# Expose the internal port your app runs on
EXPOSE 8080

# Run the application
ENTRYPOINT ["java", "-jar", "app.jar"]
