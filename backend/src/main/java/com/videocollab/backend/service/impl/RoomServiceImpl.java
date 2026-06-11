package com.videocollab.backend.service.impl;

import com.videocollab.backend.model.Room;
import com.videocollab.backend.model.User;
import com.videocollab.backend.repository.RoomRepository;
import com.videocollab.backend.service.LiveKitTokenService;
import com.videocollab.backend.service.RoomService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class RoomServiceImpl implements RoomService {

    private final RoomRepository roomRepository;
    private final LiveKitTokenService liveKitTokenService;

    private static final String CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
    private final SecureRandom random = new SecureRandom();

    private String generateRoomId() {
        StringBuilder sb = new StringBuilder("room-");
        for (int i = 0; i < 9; i++) {
            if (i == 3 || i == 6) {
                sb.append("-");
            }
            sb.append(CHARS.charAt(random.nextInt(CHARS.length())));
        }
        return sb.toString(); // Generates room-xxx-xxx-xxx format
    }

    @Override
    @Transactional
    public Room createRoom(String name, String description, int maxParticipants, boolean isMutedOnJoin, boolean isCameraOffOnJoin, boolean isApprovalRequired, User host) {
        String roomId = generateRoomId();
        // Ensure ID uniqueness
        while (roomRepository.existsById(roomId)) {
            roomId = generateRoomId();
        }

        Room room = new Room(roomId, name, description, maxParticipants, isMutedOnJoin, isCameraOffOnJoin, isApprovalRequired, host);
        return roomRepository.save(room);
    }

    @Override
    public Optional<Room> getActiveRoom(String roomId) {
        return roomRepository.findByIdAndIsActive(roomId, true);
    }

    @Override
    public List<Room> getActiveRoomsForHost(User host) {
        return roomRepository.findByHostAndIsActive(host, true);
    }

    @Override
    @Transactional
    public Room endRoom(Room room) {
        room.setActive(false);
        room.setEndedAt(LocalDateTime.now());
        return roomRepository.save(room);
    }

    @Override
    public String generateJoinToken(Room room, String identity, String displayName, boolean isHost) {
        return liveKitTokenService.generateToken(room.getId(), identity, displayName, isHost);
    }

    @Override
    public List<Room> getAllRoomsForHost(User host) {
        return roomRepository.findByHostOrderByCreatedAtDesc(host);
    }
}
