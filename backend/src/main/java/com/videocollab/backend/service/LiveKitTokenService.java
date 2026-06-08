package com.videocollab.backend.service;

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
public class LiveKitTokenService {

    @Value("${app.livekit.api-key}")
    private String apiKey;

    @Value("${app.livekit.api-secret}")
    private String apiSecret;

    private Key getSigningKey() {
        return new SecretKeySpec(apiSecret.getBytes(), SignatureAlgorithm.HS256.getJcaName());
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
