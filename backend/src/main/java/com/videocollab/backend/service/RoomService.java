package com.videocollab.backend.service;

import com.videocollab.backend.model.Room;
import com.videocollab.backend.model.User;

import java.util.List;
import java.util.Optional;

public interface RoomService {
    Room createRoom(String name, String description, int maxParticipants, boolean isMutedOnJoin, boolean isCameraOffOnJoin, boolean isApprovalRequired, User host);
    Optional<Room> getActiveRoom(String roomId);
    List<Room> getActiveRoomsForHost(User host);
    Room endRoom(Room room);
    String generateJoinToken(Room room, String identity, String displayName, boolean isHost);
    List<Room> getAllRoomsForHost(User host);
}
