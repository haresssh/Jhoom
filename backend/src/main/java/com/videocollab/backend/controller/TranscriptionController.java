package com.videocollab.backend.controller;

import com.videocollab.backend.service.DeepgramTokenService;
import com.videocollab.backend.service.RoomService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/transcription")
@RequiredArgsConstructor
public class TranscriptionController {

    private final DeepgramTokenService deepgramTokenService;
    private final RoomService roomService;

    @GetMapping("/token")
    public ResponseEntity<Map<String, Object>> getTranscriptionToken(@RequestParam String roomId) {
        // Verify that the room is currently active to prevent unauthorized API key abuse
        boolean isRoomActive = roomService.getActiveRoom(roomId).isPresent();
        if (!isRoomActive) {
            throw new AccessDeniedException("Access Denied: Ephemeral token can only be requested for active rooms");
        }

        String token = deepgramTokenService.generateEphemeralKey();
        Map<String, Object> response = new HashMap<>();
        response.put("token", token);
        
        return ResponseEntity.ok(response);
    }
}
