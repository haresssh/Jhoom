package com.videocollab.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class DeepgramTokenService {
    private static final Logger logger = LoggerFactory.getLogger(DeepgramTokenService.class);

    @Value("${app.deepgram.api-key}")
    private String masterApiKey;

    private final RestTemplate restTemplate = new RestTemplate();
    private String cachedProjectId = null;

    /**
     * Fetches the first Project ID from the Deepgram account.
     */
    private String getProjectId() {
        if (cachedProjectId != null) {
            return cachedProjectId;
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Token " + masterApiKey);
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Void> entity = new HttpEntity<>(headers);
            ResponseEntity<Map> response = restTemplate.exchange(
                    "https://api.deepgram.com/v1/projects",
                    HttpMethod.GET,
                    entity,
                    Map.class
            );

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                List<Map<String, Object>> projects = (List<Map<String, Object>>) response.getBody().get("projects");
                if (projects != null && !projects.isEmpty()) {
                    cachedProjectId = (String) projects.get(0).get("project_id");
                    logger.info("Successfully fetched and cached Deepgram Project ID: {}", cachedProjectId);
                    return cachedProjectId;
                }
            }
        } catch (Exception e) {
            logger.error("Failed to fetch Project ID from Deepgram: {}", e.getMessage());
        }
        return null;
    }

    /**
     * Generates a temporary, short-lived Deepgram API key (valid for 1 hour, scope: usage:write).
     */
    public String generateEphemeralKey() {
        String projectId = getProjectId();
        if (projectId == null) {
            logger.warn("Deepgram Project ID unavailable. Falling back to Master API Key for clients.");
            return masterApiKey; // Safe fallback
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Token " + masterApiKey);
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("comment", "Temporary client-side transcription key");
            requestBody.put("scopes", List.of("usage:write"));
            requestBody.put("time_to_live_in_seconds", 3600); // 1 hour

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
            ResponseEntity<Map> response = restTemplate.postForEntity(
                    "https://api.deepgram.com/v1/projects/" + projectId + "/keys",
                    entity,
                    Map.class
            );

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                String token = (String) response.getBody().get("key");
                if (token != null) {
                    logger.info("Successfully generated temporary Deepgram key");
                    return token;
                }
            }
        } catch (Exception e) {
            logger.error("Failed to generate temporary key from Deepgram: {}. Falling back to Master Key.", e.getMessage());
        }

        return masterApiKey; // Fallback to master key
    }
}
