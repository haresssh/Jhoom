package com.videocollab.backend.repository;

import com.videocollab.backend.model.Room;
import com.videocollab.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoomRepository extends JpaRepository<Room, String> {
    List<Room> findByHost(User host);
    List<Room> findByHostAndIsActive(User host, boolean isActive);
    Optional<Room> findByIdAndIsActive(String id, boolean isActive);
}
