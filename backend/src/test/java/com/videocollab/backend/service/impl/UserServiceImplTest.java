package com.videocollab.backend.service.impl;

import com.videocollab.backend.model.User;
import com.videocollab.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class UserServiceImplTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private UserServiceImpl userService;

    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = new User("test_host", "hashed_password");
    }

    @Test
    void existsByUsername_ShouldReturnTrue_WhenUserExists() {
        when(userRepository.existsByUsername("test_host")).thenReturn(true);

        boolean exists = userService.existsByUsername("test_host");

        assertTrue(exists);
        verify(userRepository, times(1)).existsByUsername("test_host");
    }

    @Test
    void registerUser_ShouldEncodePasswordAndSaveUser() {
        when(passwordEncoder.encode("raw_password")).thenReturn("hashed_password");
        when(userRepository.save(any(User.class))).thenReturn(testUser);

        User registeredUser = userService.registerUser("test_host", "raw_password");

        assertNotNull(registeredUser);
        assertEquals("test_host", registeredUser.getUsername());
        assertEquals("hashed_password", registeredUser.getPasswordHash());
        verify(passwordEncoder, times(1)).encode("raw_password");
        verify(userRepository, times(1)).save(any(User.class));
    }

    @Test
    void findByUsername_ShouldReturnUser_WhenUserExists() {
        when(userRepository.findByUsername("test_host")).thenReturn(Optional.of(testUser));

        Optional<User> found = userService.findByUsername("test_host");

        assertTrue(found.isPresent());
        assertEquals("test_host", found.get().getUsername());
        verify(userRepository, times(1)).findByUsername("test_host");
    }
}
