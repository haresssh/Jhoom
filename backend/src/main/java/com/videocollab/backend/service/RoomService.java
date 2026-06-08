package com.videocollab.backend.service;

import com.videocollab.backend.model.Room;
import com.videocollab.backend.model.User;
import com.videocollab.backend.repository.RoomRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class RoomService {

    @Autowired
    private RoomRepository roomRepository;

    @Autowired
    private LiveKitTokenService liveKitTokenService;

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

    public Room createRoom(String name, User host) {
        String roomId = generateRoomId();
        // Ensure ID uniqueness
        while (roomRepository.existsById(roomId)) {
            roomId = generateRoomId();
        }

        Room room = new Room(roomId, name, host);
        return roomRepository.save(room);
    }

    public Optional<Room> getActiveRoom(String roomId) {
        return roomRepository.findByIdAndIsActive(roomId, true);
    }

    public List<Room> getActiveRoomsForHost(User host) {
        return roomRepository.findByHostAndIsActive(host, true);
    }

    public Room endRoom(Room room) {
        room.setActive(false);
        room.setEndedAt(LocalDateTime.now());
        return roomRepository.save(room);
    }

    public String generateJoinToken(Room room, String identity, String displayName, boolean isHost) {
        return liveKitTokenService.generateToken(room.getId(), identity, displayName, isHost);
    }
}
