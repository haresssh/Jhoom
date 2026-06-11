package com.videocollab.backend.repository;

import com.videocollab.backend.model.JoinRequest;
import com.videocollab.backend.model.JoinRequest.JoinRequestStatus;
import com.videocollab.backend.model.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface JoinRequestRepository extends JpaRepository<JoinRequest, String> {
    List<JoinRequest> findByRoomAndStatus(Room room, JoinRequestStatus status);
}
