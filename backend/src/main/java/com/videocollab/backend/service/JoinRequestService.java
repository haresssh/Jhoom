package com.videocollab.backend.service;

import com.videocollab.backend.model.JoinRequest;
import com.videocollab.backend.model.Room;

import java.util.List;
import java.util.Optional;

public interface JoinRequestService {
    JoinRequest createRequest(Room room, String displayName);
    JoinRequest approveRequest(JoinRequest request, String token);
    JoinRequest denyRequest(JoinRequest request);
    List<JoinRequest> getPendingRequests(Room room);
    Optional<JoinRequest> getRequest(String requestId);
}
