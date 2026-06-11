package com.videocollab.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RoomResponse {
    private String roomId;
    private String roomName;
    private String token;
    private String livekitUrl;
    private String role;
    private String description;
    private int maxParticipants;
    @JsonProperty("isMutedOnJoin")
    private boolean isMutedOnJoin;
    @JsonProperty("isCameraOffOnJoin")
    private boolean isCameraOffOnJoin;
    @JsonProperty("isApprovalRequired")
    private boolean isApprovalRequired;
}
