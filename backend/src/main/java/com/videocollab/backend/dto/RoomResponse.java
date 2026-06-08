package com.videocollab.backend.dto;

public class RoomResponse {
    private String roomId;
    private String roomName;
    private String token;
    private String livekitUrl;
    private String role;

    public RoomResponse(String roomId, String roomName, String token, String livekitUrl, String role) {
        this.roomId = roomId;
        this.roomName = roomName;
        this.token = token;
        this.livekitUrl = livekitUrl;
        this.role = role;
    }

    // Getters and Setters
    public String getRoomId() {
        return roomId;
    }

    public void setRoomId(String roomId) {
        this.roomId = roomId;
    }

    public String getRoomName() {
        return roomName;
    }

    public void setRoomName(String roomName) {
        this.roomName = roomName;
    }

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public String getLivekitUrl() {
        return livekitUrl;
    }

    public void setLivekitUrl(String livekitUrl) {
        this.livekitUrl = livekitUrl;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }
}
