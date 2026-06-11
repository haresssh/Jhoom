package com.videocollab.backend.service.impl;

import com.videocollab.backend.service.LiveKitTokenService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.spec.SecretKeySpec;
import java.security.Key;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Service
public class LiveKitTokenServiceImpl implements LiveKitTokenService {

    private final String apiKey;
    private final String apiSecret;

    public LiveKitTokenServiceImpl(@Value("${app.livekit.api-key}") String apiKey,
                                   @Value("${app.livekit.api-secret}") String apiSecret) {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
    }

    private Key getSigningKey() {
        byte[] secretBytes = apiSecret.getBytes();
        if (secretBytes.length < 32) {
            byte[] paddedBytes = new byte[32];
            System.arraycopy(secretBytes, 0, paddedBytes, 0, secretBytes.length);
            // Log a warning that a padded key will be used
            System.err.println("WARNING: LiveKit API secret is less than 32 bytes. Padded to 32 bytes for HS256 compliance.");
            secretBytes = paddedBytes;
        }
        return new SecretKeySpec(secretBytes, SignatureAlgorithm.HS256.getJcaName());
    }

    /**
     * Generates a signed LiveKit Access Token.
     *
     * @param roomName    The unique room ID
     * @param identity    The unique participant identity
     * @param displayName The participant's friendly name
     * @param isHost      True if the participant is the host
     * @return A signed JWT token string
     */
    @Override
    public String generateToken(String roomName, String identity, String displayName, boolean isHost) {
        long nowMs = System.currentTimeMillis();
        long expMs = nowMs + 14400000; // 4 hours expiration

        // Video permissions claim required by LiveKit
        Map<String, Object> videoGrant = new HashMap<>();
        videoGrant.put("roomJoin", true);
        videoGrant.put("room", roomName);
        videoGrant.put("canPublish", true);
        videoGrant.put("canSubscribe", true);
        videoGrant.put("canPublishData", true);
        
        if (isHost) {
            videoGrant.put("roomAdmin", true);
        }

        // Custom metadata (e.g. host/guest distinction)
        String metadataJson = String.format("{\"role\":\"%s\"}", isHost ? "host" : "guest");

        return Jwts.builder()
                .setIssuer(apiKey)
                .setSubject(identity)
                .claim("name", displayName)
                .claim("video", videoGrant)
                .claim("metadata", metadataJson)
                .setIssuedAt(new Date(nowMs))
                .setExpiration(new Date(expMs))
                .signWith(getSigningKey(), SignatureAlgorithm.HS256)
                .compact();
    }
}
