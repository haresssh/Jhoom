package com.videocollab.backend.service.impl;

import com.videocollab.backend.model.Room;
import com.videocollab.backend.model.User;
import com.videocollab.backend.repository.RoomRepository;
import com.videocollab.backend.service.LiveKitTokenService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class RoomServiceImplTest {

    @Mock
    private RoomRepository roomRepository;

    @Mock
    private LiveKitTokenService liveKitTokenService;

    @InjectMocks
    private RoomServiceImpl roomService;

    private User host;
    private Room testRoom;

    @BeforeEach
    void setUp() {
        host = new User("host_user", "hashed_password");
        testRoom = new Room("room-abc-123", "Weekly Sync", "Sync agenda", 20, false, false, false, host);
    }

    @Test
    void createRoom_ShouldGenerateIdAndSaveRoom() {
        when(roomRepository.existsById(any(String.class))).thenReturn(false);
        when(roomRepository.save(any(Room.class))).thenReturn(testRoom);

        Room created = roomService.createRoom("Weekly Sync", "Sync agenda", 20, false, false, false, host);

        assertNotNull(created);
        assertEquals("Weekly Sync", created.getName());
        assertEquals("Sync agenda", created.getDescription());
        assertEquals(20, created.getMaxParticipants());
        verify(roomRepository, times(1)).save(any(Room.class));
    }

    @Test
    void getActiveRoom_ShouldReturnRoom_WhenActive() {
        when(roomRepository.findByIdAndIsActive("room-abc-123", true)).thenReturn(Optional.of(testRoom));

        Optional<Room> found = roomService.getActiveRoom("room-abc-123");

        assertTrue(found.isPresent());
        assertEquals("Weekly Sync", found.get().getName());
        verify(roomRepository, times(1)).findByIdAndIsActive("room-abc-123", true);
    }

    @Test
    void endRoom_ShouldSetIsActiveFalseAndSave() {
        when(roomRepository.save(any(Room.class))).thenReturn(testRoom);

        Room ended = roomService.endRoom(testRoom);

        assertNotNull(ended);
        assertFalse(ended.isActive());
        assertNotNull(ended.getEndedAt());
        verify(roomRepository, times(1)).save(testRoom);
    }

    @Test
    void generateJoinToken_ShouldCallLiveKitTokenService() {
        when(liveKitTokenService.generateToken("room-abc-123", "identity_1", "Guest Name", false))
                .thenReturn("dummy_token");

        String token = roomService.generateJoinToken(testRoom, "identity_1", "Guest Name", false);

        assertEquals("dummy_token", token);
        verify(liveKitTokenService, times(1)).generateToken("room-abc-123", "identity_1", "Guest Name", false);
    }
}
