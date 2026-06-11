package com.videocollab.backend.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity
@Table(name = "join_requests")
@Getter
@Setter
@NoArgsConstructor
public class JoinRequest {

    public enum JoinRequestStatus {
        PENDING,
        APPROVED,
        DENIED
    }

    @Id
    @Column(length = 100)
    private String id; // Unique UUID string

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @Column(name = "display_name", nullable = false, length = 100)
    private String displayName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private JoinRequestStatus status = JoinRequestStatus.PENDING;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(length = 1000)
    private String token; // Stores guest token once approved

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public JoinRequest(String id, Room room, String displayName) {
        this.id = id;
        this.room = room;
        this.displayName = displayName;
        this.status = JoinRequestStatus.PENDING;
    }
}
