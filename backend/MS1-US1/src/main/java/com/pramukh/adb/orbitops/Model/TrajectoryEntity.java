package com.pramukh.adb.orbitops.Model;
import com.pramukh.adb.orbitops.DTO.SatellitePositionDTO;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.List;

@Document(collection = "satellite_trajectories")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TrajectoryEntity {
    @Id
    private Long noradID;
    private String satelliteName;
    private List<SatellitePositionDTO> trajectory;
}
