package com.videocollab.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.List;

@SpringBootApplication
public class VideoCollabApplication {
    public static void main(String[] args) {
        loadDotEnv();
        SpringApplication.run(VideoCollabApplication.class, args);
    }

    private static void loadDotEnv() {
        String[] potentialPaths = {
            "../.env",
            "./.env",
            "backend/.env",
            ".env"
        };
        for (String path : potentialPaths) {
            File envFile = new File(path);
            if (envFile.exists() && envFile.isFile()) {
                System.out.println("Loading environment variables from: " + envFile.getAbsolutePath());
                try {
                    List<String> lines = Files.readAllLines(Paths.get(envFile.toURI()));
                    for (String line : lines) {
                        line = line.trim();
                        if (line.isEmpty() || line.startsWith("#")) {
                            continue;
                        }
                        int eqIdx = line.indexOf('=');
                        if (eqIdx > 0) {
                            String key = line.substring(0, eqIdx).trim();
                            String value = line.substring(eqIdx + 1).trim();
                            // Strip quotes if present
                            if ((value.startsWith("\"") && value.endsWith("\"")) ||
                                (value.startsWith("'") && value.endsWith("'"))) {
                                value = value.substring(1, value.length() - 1);
                            }
                            if (System.getenv(key) == null && System.getProperty(key) == null) {
                                System.setProperty(key, value);
                            }
                        }
                    }
                    break; // stop looking once we successfully load one
                } catch (Exception e) {
                    System.err.println("Failed to load .env file: " + e.getMessage());
                }
            }
        }
    }
}

