package com.videocollab.backend.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDateTime;

@Entity
@Table(name = "rooms")
@Getter
@Setter
@NoArgsConstructor
public class Room {

    @Id
    @Column(length = 100)
    private String id; // Unique custom slug or UUID

    @Column(nullable = false, length = 100)
    private String name;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "host_id", nullable = false)
    private User host;

    @Column(name = "is_active", nullable = false)
    @JsonProperty("isActive")
    private boolean isActive = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "ended_at")
    private LocalDateTime endedAt;

    @Column(length = 255)
    private String description;

    @Column(name = "max_participants", nullable = false)
    private int maxParticipants = 20;

    @Column(name = "is_muted_on_join", nullable = false)
    @JsonProperty("isMutedOnJoin")
    private boolean isMutedOnJoin = false;

    @Column(name = "is_camera_off_on_join", nullable = false)
    @JsonProperty("isCameraOffOnJoin")
    private boolean isCameraOffOnJoin = false;

    @Column(name = "is_approval_required", nullable = false)
    @JsonProperty("isApprovalRequired")
    private boolean isApprovalRequired = false;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    // Convenience Constructor
    public Room(String id, String name, User host) {
        this.id = id;
        this.name = name;
        this.host = host;
        this.isActive = true;
    }

    // Detailed Convenience Constructor
    public Room(String id, String name, String description, int maxParticipants, boolean isMutedOnJoin, boolean isCameraOffOnJoin, boolean isApprovalRequired, User host) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.maxParticipants = maxParticipants;
        this.isMutedOnJoin = isMutedOnJoin;
        this.isCameraOffOnJoin = isCameraOffOnJoin;
        this.isApprovalRequired = isApprovalRequired;
        this.host = host;
        this.isActive = true;
    }
}
