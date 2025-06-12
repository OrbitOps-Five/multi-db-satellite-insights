package com.pramukh.adb.orbitops.DTO;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TrajectoryDTO {
    private long noradID;
    private String satelliteName;
    private List<SatellitePositionDTO> trajectory;


}
