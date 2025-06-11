package com.pramukh.adb.orbitops.Controller;

import com.pramukh.adb.orbitops.Model.SatelliteTle;
import com.pramukh.adb.orbitops.Service.SatellitePositionCalculationService;
import com.pramukh.adb.orbitops.Service.SatilliteService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/satillite")
public class SatilliteController {
    private SatilliteService satilliteService;
    private SatellitePositionCalculationService satellitePositionCalculationService;

    @Autowired
    public SatilliteController(SatilliteService satilliteService, SatellitePositionCalculationService satellitePositionCalculationService) {
        this.satilliteService = satilliteService;
        this.satellitePositionCalculationService = satellitePositionCalculationService;
    }

    @PostMapping("/addTleData")
    public String addSatilliteMetadata() {
        return satilliteService.addSatilliteMetadata();
    }

    @GetMapping("/getTleData")
    public List<SatelliteTle> getSatilliteMetadata() {
        return satilliteService.getAllSatilliteMetadata();
    }

    @PostMapping("/calculatePositions")
    public String Positions() {
        satellitePositionCalculationService.calculatePositions();
        return "Positions added successfully";
    }
}
