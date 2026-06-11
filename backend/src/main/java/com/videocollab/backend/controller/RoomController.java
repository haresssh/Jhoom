package com.videocollab.backend.controller;

import com.videocollab.backend.dto.CreateRoomRequest;
import com.videocollab.backend.dto.JoinRoomRequest;
import com.videocollab.backend.dto.MessageResponse;
import com.videocollab.backend.dto.RoomResponse;
import com.videocollab.backend.model.Room;
import com.videocollab.backend.model.User;
import com.videocollab.backend.service.RoomService;
import com.videocollab.backend.service.UserService;
import com.videocollab.backend.dto.JoinRequestResponse;
import com.videocollab.backend.model.JoinRequest;
import com.videocollab.backend.service.JoinRequestService;
import com.videocollab.backend.exception.ResourceNotFoundException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    private final RoomService roomService;
    private final UserService userService;
    private final JoinRequestService joinRequestService;
    private final String livekitUrl;

    public RoomController(RoomService roomService,
                          UserService userService,
                          JoinRequestService joinRequestService,
                          @Value("${app.livekit.url}") String livekitUrl) {
        this.roomService = roomService;
        this.userService = userService;
        this.joinRequestService = joinRequestService;
        this.livekitUrl = livekitUrl;
    }

    private User getAuthenticatedUser(UserDetails userDetails) {
        if (userDetails == null) return null;
        return userService.findByUsername(userDetails.getUsername()).orElse(null);
    }

    @PostMapping
    public ResponseEntity<RoomResponse> createRoom(@RequestBody CreateRoomRequest request,
                                                   @AuthenticationPrincipal UserDetails userDetails) {
        User host = getAuthenticatedUser(userDetails);
        if (host == null) {
            throw new BadCredentialsException("Unauthorized host");
        }

        Room room = roomService.createRoom(
                request.getRoomName(),
                request.getDescription(),
                request.getMaxParticipants(),
                request.isMutedOnJoin(),
                request.isCameraOffOnJoin(),
                request.isApprovalRequired(),
                host
        );
        String hostIdentity = "host-" + host.getUsername() + "-" + UUID.randomUUID().toString().substring(0, 6);
        String token = roomService.generateJoinToken(room, hostIdentity, host.getUsername(), true);

        return ResponseEntity.status(HttpStatus.CREATED).body(
                new RoomResponse(
                        room.getId(),
                        room.getName(),
                        token,
                        livekitUrl,
                        "host",
                        room.getDescription(),
                        room.getMaxParticipants(),
                        room.isMutedOnJoin(),
                        room.isCameraOffOnJoin(),
                        room.isApprovalRequired()
                )
        );
    }

    @PostMapping("/{roomId}/join")
    public ResponseEntity<RoomResponse> joinRoom(@PathVariable String roomId,
                                                 @RequestBody(required = false) JoinRoomRequest request,
                                                 @AuthenticationPrincipal UserDetails userDetails) {
        Room room = roomService.getActiveRoom(roomId)
                .orElseThrow(() -> new ResourceNotFoundException("Active meeting room not found"));

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
                new RoomResponse(
                        room.getId(),
                        room.getName(),
                        token,
                        livekitUrl,
                        isHost ? "host" : "guest",
                        room.getDescription(),
                        room.getMaxParticipants(),
                        room.isMutedOnJoin(),
                        room.isCameraOffOnJoin(),
                        room.isApprovalRequired()
                )
        );
    }

    @PostMapping("/{roomId}/end")
    public ResponseEntity<MessageResponse> endRoom(@PathVariable String roomId,
                                                 @AuthenticationPrincipal UserDetails userDetails) {
        Room room = roomService.getActiveRoom(roomId)
                .orElseThrow(() -> new ResourceNotFoundException("Active meeting room not found"));

        User currentUser = getAuthenticatedUser(userDetails);
        if (currentUser == null || !room.getHost().getId().equals(currentUser.getId())) {
            throw new AccessDeniedException("Only the host can end this meeting");
        }

        roomService.endRoom(room);
        return ResponseEntity.ok(new MessageResponse("Meeting room ended successfully"));
    }

    @GetMapping("/active")
    public ResponseEntity<List<Room>> getActiveRooms(@AuthenticationPrincipal UserDetails userDetails) {
        User host = getAuthenticatedUser(userDetails);
        if (host == null) {
            throw new BadCredentialsException("Unauthorized host");
        }

        List<Room> rooms = roomService.getActiveRoomsForHost(host);
        return ResponseEntity.ok(rooms);
    }

    @GetMapping("/history")
    public ResponseEntity<List<Room>> getRoomHistory(@AuthenticationPrincipal UserDetails userDetails) {
        User host = getAuthenticatedUser(userDetails);
        if (host == null) {
            throw new BadCredentialsException("Unauthorized host");
        }
        List<Room> rooms = roomService.getAllRoomsForHost(host);
        return ResponseEntity.ok(rooms);
    }

    @GetMapping("/{roomId}/metadata")
    public ResponseEntity<RoomResponse> getRoomMetadata(@PathVariable String roomId) {
        Room room = roomService.getActiveRoom(roomId)
                .orElseThrow(() -> new ResourceNotFoundException("Active meeting room not found"));
        return ResponseEntity.ok(
                new RoomResponse(
                        room.getId(),
                        room.getName(),
                        null,
                        livekitUrl,
                        null,
                        room.getDescription(),
                        room.getMaxParticipants(),
                        room.isMutedOnJoin(),
                        room.isCameraOffOnJoin(),
                        room.isApprovalRequired()
                )
        );
    }

    @PostMapping("/{roomId}/requests")
    public ResponseEntity<JoinRequestResponse> createJoinRequest(@PathVariable String roomId,
                                                                 @RequestBody JoinRoomRequest request) {
        Room room = roomService.getActiveRoom(roomId)
                .orElseThrow(() -> new ResourceNotFoundException("Active meeting room not found"));

        String displayName = (request != null && request.getDisplayName() != null && !request.getDisplayName().trim().isEmpty())
                ? request.getDisplayName().trim()
                : "Guest-" + UUID.randomUUID().toString().substring(0, 4);

        JoinRequest joinRequest = joinRequestService.createRequest(room, displayName);
        return ResponseEntity.status(HttpStatus.CREATED).body(
                new JoinRequestResponse(
                        joinRequest.getId(),
                        room.getId(),
                        joinRequest.getDisplayName(),
                        joinRequest.getStatus().name(),
                        null
                )
        );
    }

    @GetMapping("/requests/{requestId}/status")
    public ResponseEntity<JoinRequestResponse> getJoinRequestStatus(@PathVariable String requestId) {
        JoinRequest joinRequest = joinRequestService.getRequest(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Join request not found"));

        return ResponseEntity.ok(
                new JoinRequestResponse(
                        joinRequest.getId(),
                        joinRequest.getRoom().getId(),
                        joinRequest.getDisplayName(),
                        joinRequest.getStatus().name(),
                        joinRequest.getToken()
                )
        );
    }

    @GetMapping("/{roomId}/requests/pending")
    public ResponseEntity<List<JoinRequestResponse>> getPendingRequests(@PathVariable String roomId,
                                                                        @AuthenticationPrincipal UserDetails userDetails) {
        Room room = roomService.getActiveRoom(roomId)
                .orElseThrow(() -> new ResourceNotFoundException("Active meeting room not found"));

        User currentUser = getAuthenticatedUser(userDetails);
        if (currentUser == null || !room.getHost().getId().equals(currentUser.getId())) {
            throw new AccessDeniedException("Only the host can inspect join requests");
        }

        List<JoinRequest> pending = joinRequestService.getPendingRequests(room);
        List<JoinRequestResponse> response = pending.stream()
                .map(r -> new JoinRequestResponse(r.getId(), room.getId(), r.getDisplayName(), r.getStatus().name(), null))
                .toList();

        return ResponseEntity.ok(response);
    }

    @PostMapping("/requests/{requestId}/approve")
    public ResponseEntity<MessageResponse> approveJoinRequest(@PathVariable String requestId,
                                                              @AuthenticationPrincipal UserDetails userDetails) {
        JoinRequest joinRequest = joinRequestService.getRequest(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Join request not found"));

        Room room = joinRequest.getRoom();
        User currentUser = getAuthenticatedUser(userDetails);
        if (currentUser == null || !room.getHost().getId().equals(currentUser.getId())) {
            throw new AccessDeniedException("Only the host can approve join requests");
        }

        // Generate the LiveKit token for the guest
        String guestIdentity = "guest-" + UUID.randomUUID().toString().substring(0, 8);
        String token = roomService.generateJoinToken(room, guestIdentity, joinRequest.getDisplayName(), false);

        joinRequestService.approveRequest(joinRequest, token);
        return ResponseEntity.ok(new MessageResponse("Request approved"));
    }

    @PostMapping("/requests/{requestId}/deny")
    public ResponseEntity<MessageResponse> denyJoinRequest(@PathVariable String requestId,
                                                           @AuthenticationPrincipal UserDetails userDetails) {
        JoinRequest joinRequest = joinRequestService.getRequest(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Join request not found"));

        Room room = joinRequest.getRoom();
        User currentUser = getAuthenticatedUser(userDetails);
        if (currentUser == null || !room.getHost().getId().equals(currentUser.getId())) {
            throw new AccessDeniedException("Only the host can deny join requests");
        }

        joinRequestService.denyRequest(joinRequest);
        return ResponseEntity.ok(new MessageResponse("Request denied"));
    }
}
