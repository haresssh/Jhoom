package com.videocollab.backend.service.impl;

import com.videocollab.backend.model.JoinRequest;
import com.videocollab.backend.model.JoinRequest.JoinRequestStatus;
import com.videocollab.backend.model.Room;
import com.videocollab.backend.repository.JoinRequestRepository;
import com.videocollab.backend.service.JoinRequestService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class JoinRequestServiceImpl implements JoinRequestService {

    private final JoinRequestRepository joinRequestRepository;

    @Override
    @Transactional
    public JoinRequest createRequest(Room room, String displayName) {
        String id = UUID.randomUUID().toString();
        JoinRequest request = new JoinRequest(id, room, displayName);
        return joinRequestRepository.save(request);
    }

    @Override
    @Transactional
    public JoinRequest approveRequest(JoinRequest request, String token) {
        request.setStatus(JoinRequestStatus.APPROVED);
        request.setToken(token);
        return joinRequestRepository.save(request);
    }

    @Override
    @Transactional
    public JoinRequest denyRequest(JoinRequest request) {
        request.setStatus(JoinRequestStatus.DENIED);
        return joinRequestRepository.save(request);
    }

    @Override
    public List<JoinRequest> getPendingRequests(Room room) {
        return joinRequestRepository.findByRoomAndStatus(room, JoinRequestStatus.PENDING);
    }

    @Override
    public Optional<JoinRequest> getRequest(String requestId) {
        return joinRequestRepository.findById(requestId);
    }
}
