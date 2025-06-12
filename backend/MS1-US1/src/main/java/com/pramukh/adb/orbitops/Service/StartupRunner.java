package com.pramukh.adb.orbitops.Service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class StartupRunner implements ApplicationRunner {
    private SatilliteService satilliteService;
    private TrajectoryCalculation trajectoryCalculation;

    @Autowired
    public StartupRunner(SatilliteService satilliteService, TrajectoryCalculation trajectoryCalculation) {
        this.satilliteService = satilliteService;
        this.trajectoryCalculation = trajectoryCalculation;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        satilliteService.addSatilliteMetadata();
        trajectoryCalculation.storeTracjectories();
    }
}
