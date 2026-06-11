package com.videocollab.backend.service;

import com.videocollab.backend.model.User;
import java.util.Optional;

public interface UserService {
    boolean existsByUsername(String username);
    User registerUser(String username, String rawPassword);
    Optional<User> findByUsername(String username);
}
