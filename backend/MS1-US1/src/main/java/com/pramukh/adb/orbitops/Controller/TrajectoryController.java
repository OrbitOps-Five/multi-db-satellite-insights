package com.pramukh.adb.orbitops.Controller;

import com.pramukh.adb.orbitops.DTO.TrajectoryDTO;
import com.pramukh.adb.orbitops.Model.TrajectoryEntity;
import com.pramukh.adb.orbitops.Service.TrajectoryCalculation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/trajectory")
public class TrajectoryController {


    private TrajectoryCalculation trajectoryCalculation;

    @Autowired
    public TrajectoryController(TrajectoryCalculation trajectoryCalculation) {
        this.trajectoryCalculation = trajectoryCalculation;
    }

    @PostMapping("/generate")
    public ResponseEntity<String> generate() {
        trajectoryCalculation.storeTracjectories();
        return ResponseEntity.ok("Trajectories generated and saved to MongoDB.");
    }

    @CrossOrigin(origins = "*")
    @GetMapping("/{noradID}")
    public ResponseEntity<TrajectoryDTO> getTrajectory(@PathVariable long noradID) {
        TrajectoryEntity entity = trajectoryCalculation.getTrajectoryByNoradId(noradID);
        if (entity == null) return ResponseEntity.notFound().build();
        TrajectoryDTO dto = new TrajectoryDTO(entity.getNoradID(),entity.getSatelliteName(),entity.getTrajectory());
        return ResponseEntity.ok(dto);
    }
}
