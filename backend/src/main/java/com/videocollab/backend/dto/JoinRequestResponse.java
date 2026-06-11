package com.videocollab.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class JoinRequestResponse {
    private String requestId;
    private String roomId;
    private String displayName;
    private String status;
    private String token;
}
