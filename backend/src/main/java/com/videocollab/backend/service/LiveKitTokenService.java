package com.videocollab.backend.service;

public interface LiveKitTokenService {
    String generateToken(String roomName, String identity, String displayName, boolean isHost);
}
