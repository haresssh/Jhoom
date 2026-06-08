package com.videocollab.backend.controller;

import com.videocollab.backend.dto.MessageResponse;
import com.videocollab.backend.service.DeepgramTokenService;
import com.videocollab.backend.service.RoomService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/transcription")
public class TranscriptionController {

    @Autowired
    private DeepgramTokenService deepgramTokenService;

    @Autowired
    private RoomService roomService;

    @GetMapping("/token")
    public ResponseEntity<?> getTranscriptionToken(@RequestParam String roomId) {
        // Verify that the room is currently active to prevent unauthorized API key abuse
        boolean isRoomActive = roomService.getActiveRoom(roomId).isPresent();
        if (!isRoomActive) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new MessageResponse("Access Denied: Ephemeral token can only be requested for active rooms"));
        }

        String token = deepgramTokenService.generateEphemeralKey();
        Map<String, Object> response = new HashMap<>();
        response.put("token", token);
        
        return ResponseEntity.ok(response);
    }
}
