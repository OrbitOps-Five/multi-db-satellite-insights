package com.pramukh.adb.orbitops.Service;

import com.pramukh.adb.orbitops.Model.SatelliteTle;
import com.pramukh.adb.orbitops.Repository.SatellieTleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.ArrayList;
import java.util.List;


@Service
public class SatilliteService {
    private WebClient webClient;
    private SatellieTleRepository repository;
    private SatellitePositionCalculationService satellitePositionCalculationService;


    @Autowired
    public SatilliteService(WebClient webClient, SatellieTleRepository repository, SatellitePositionCalculationService satellitePositionCalculationService) {
        this.webClient = webClient;
        this.repository = repository;
        this.satellitePositionCalculationService = satellitePositionCalculationService;
    }


    public String addSatilliteMetadata() {
        System.out.println("Adding to TLE Started.");
        String url = "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle";
        String result = webClient.get().uri(url).retrieve().bodyToMono(String.class).block();
        List<SatelliteTle> satilliteList = parsing(result);
        System.out.println("Inserting to mango DB");
        repository.saveAll(satilliteList);
//        satellitePositionCalculationService.setTleReady(true);
        return "Satillite Metadata added successfully";

    }

    public List<SatelliteTle> getAllSatilliteMetadata() {
        return repository.findAll();
    }

    public List<SatelliteTle> parsing(String tleText) {
        List<SatelliteTle> satilliteList = new ArrayList<>();
        String[] lines = tleText.split("\\r?\\n");
        for (int i = 0; i < lines.length - 2; i = i + 3) {
            String name = lines[i].trim();
            String line1 = lines[i + 1];
            String line2 = lines[i + 2];
            long noradId = Long.parseLong(line1.substring(2, 7).trim());
            SatelliteTle satillite = new SatelliteTle();
            satillite.setNoradID(noradId);
            satillite.setSatilliteName(name);
            satillite.setTle1(line1);
            satillite.setTle2(line2);
            satilliteList.add(satillite);
        }
        return satilliteList;
    }

}



