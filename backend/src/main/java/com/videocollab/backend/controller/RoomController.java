package com.videocollab.backend.controller;

import com.videocollab.backend.dto.CreateRoomRequest;
import com.videocollab.backend.dto.JoinRoomRequest;
import com.videocollab.backend.dto.MessageResponse;
import com.videocollab.backend.dto.RoomResponse;
import com.videocollab.backend.model.Room;
import com.videocollab.backend.model.User;
import com.videocollab.backend.repository.UserRepository;
import com.videocollab.backend.security.UserDetailsImpl;
import com.videocollab.backend.service.RoomService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    @Autowired
    private RoomService roomService;

    @Autowired
    private UserRepository userRepository;

    @Value("${app.livekit.url}")
    private String livekitUrl;

    private User getAuthenticatedUser(UserDetails userDetails) {
        if (userDetails == null) return null;
        return userRepository.findByUsername(userDetails.getUsername()).orElse(null);
    }

    @PostMapping
    public ResponseEntity<?> createRoom(@RequestBody CreateRoomRequest request,
                                        @AuthenticationPrincipal UserDetails userDetails) {
        User host = getAuthenticatedUser(userDetails);
        if (host == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Unauthorized"));
        }

        Room room = roomService.createRoom(request.getRoomName(), host);
        String hostIdentity = "host-" + host.getUsername() + "-" + UUID.randomUUID().toString().substring(0, 6);
        String token = roomService.generateJoinToken(room, hostIdentity, host.getUsername(), true);

        return ResponseEntity.status(HttpStatus.CREATED).body(
                new RoomResponse(room.getId(), room.getName(), token, livekitUrl, "host")
        );
    }

    @PostMapping("/{roomId}/join")
    public ResponseEntity<?> joinRoom(@PathVariable String roomId,
                                      @RequestBody(required = false) JoinRoomRequest request,
                                      @AuthenticationPrincipal UserDetails userDetails) {
        Room room = roomService.getActiveRoom(roomId).orElse(null);
        if (room == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Active meeting room not found"));
        }

        User currentUser = getAuthenticatedUser(userDetails);
        boolean isHost = currentUser != null && room.getHost().getId().equals(currentUser.getId());

        String identity;
        String displayName;

        if (isHost) {
            identity = "host-" + currentUser.getUsername() + "-" + UUID.randomUUID().toString().substring(0, 6);
            displayName = currentUser.getUsername();
        } else {
            String name = (request != null && request.getDisplayName() != null && !request.getDisplayName().trim().isEmpty())
                    ? request.getDisplayName().trim()
                    : "Guest-" + UUID.randomUUID().toString().substring(0, 4);
            identity = "guest-" + UUID.randomUUID().toString().substring(0, 8);
            displayName = name;
        }

        String token = roomService.generateJoinToken(room, identity, displayName, isHost);

        return ResponseEntity.ok(
                new RoomResponse(room.getId(), room.getName(), token, livekitUrl, isHost ? "host" : "guest")
        );
    }

    @PostMapping("/{roomId}/end")
    public ResponseEntity<?> endRoom(@PathVariable String roomId,
                                     @AuthenticationPrincipal UserDetails userDetails) {
        Room room = roomService.getActiveRoom(roomId).orElse(null);
        if (room == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Active meeting room not found"));
        }

        User currentUser = getAuthenticatedUser(userDetails);
        if (currentUser == null || !room.getHost().getId().equals(currentUser.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new MessageResponse("Only the host can end this meeting"));
        }

        roomService.endRoom(room);
        return ResponseEntity.ok(new MessageResponse("Meeting room ended successfully"));
    }

    @GetMapping("/active")
    public ResponseEntity<?> getActiveRooms(@AuthenticationPrincipal UserDetails userDetails) {
        User host = getAuthenticatedUser(userDetails);
        if (host == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new MessageResponse("Unauthorized"));
        }

        List<Room> rooms = roomService.getActiveRoomsForHost(host);
        return ResponseEntity.ok(rooms);
    }
}
