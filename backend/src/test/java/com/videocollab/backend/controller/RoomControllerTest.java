package com.videocollab.backend.controller;

import com.videocollab.backend.model.Room;
import com.videocollab.backend.model.User;
import com.videocollab.backend.service.RoomService;
import com.videocollab.backend.service.UserService;
import com.videocollab.backend.service.JoinRequestService;
import com.videocollab.backend.security.JwtUtils;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = RoomController.class, excludeAutoConfiguration = SecurityAutoConfiguration.class)
@TestPropertySource(properties = "app.livekit.url=wss://test.livekit.cloud")
public class RoomControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private RoomService roomService;

    @MockBean
    private UserService userService;

    @MockBean
    private JoinRequestService joinRequestService;

    @MockBean
    private JwtUtils jwtUtils;

    @MockBean
    private UserDetailsService userDetailsService;

    @Test
    void getRoomMetadata_ShouldReturnRoomDetails_WhenRoomIsActive() throws Exception {
        User host = new User("host_user", "hashed_password");
        Room activeRoom = new Room("room-abc-123", "Weekly Sync", "Sync agenda", 20, false, false, false, host);

        when(roomService.getActiveRoom("room-abc-123")).thenReturn(Optional.of(activeRoom));

        mockMvc.perform(get("/api/rooms/room-abc-123/metadata"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roomId").value("room-abc-123"))
                .andExpect(jsonPath("$.roomName").value("Weekly Sync"))
                .andExpect(jsonPath("$.description").value("Sync agenda"))
                .andExpect(jsonPath("$.maxParticipants").value(20));

        verify(roomService, times(1)).getActiveRoom("room-abc-123");
    }

    @Test
    void getRoomMetadata_ShouldReturn404_WhenRoomIsInactive() throws Exception {
        when(roomService.getActiveRoom("room-abc-123")).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/rooms/room-abc-123/metadata"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Active meeting room not found"));

        verify(roomService, times(1)).getActiveRoom("room-abc-123");
    }
}
