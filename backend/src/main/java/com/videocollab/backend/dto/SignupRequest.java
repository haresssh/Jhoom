package com.videocollab.backend.dto;

import lombok.Data;

@Data
public class SignupRequest {
    private String username;
    private String password;
}
