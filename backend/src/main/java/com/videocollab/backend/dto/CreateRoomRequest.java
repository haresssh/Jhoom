package com.videocollab.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class CreateRoomRequest {
    private String roomName;
    private String description;
    private int maxParticipants;
    @JsonProperty("isMutedOnJoin")
    private boolean isMutedOnJoin;
    @JsonProperty("isCameraOffOnJoin")
    private boolean isCameraOffOnJoin;
    @JsonProperty("isApprovalRequired")
    private boolean isApprovalRequired;
}
