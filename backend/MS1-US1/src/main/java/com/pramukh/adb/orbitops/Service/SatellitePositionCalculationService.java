package com.pramukh.adb.orbitops.Service;

import com.pramukh.adb.orbitops.DTO.SatellitePositionDTO;
import com.pramukh.adb.orbitops.Model.SatelliteTle;
import com.pramukh.adb.orbitops.Repository.SatellieTleRepository;
import lombok.Setter;
import org.orekit.bodies.GeodeticPoint;
import org.orekit.bodies.OneAxisEllipsoid;
import org.orekit.data.DataContext;
import org.orekit.data.DirectoryCrawler;
import org.orekit.frames.Frame;
import org.orekit.frames.FramesFactory;
import org.orekit.propagation.analytical.tle.TLE;
import org.orekit.propagation.analytical.tle.TLEPropagator;
import org.orekit.time.AbsoluteDate;
import org.orekit.time.TimeScalesFactory;
import org.orekit.utils.Constants;
import org.orekit.utils.IERSConventions;
import org.orekit.utils.PVCoordinates;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Service
public class SatellitePositionCalculationService {
    int count = 0;
    private SatellieTleRepository satellieTleRepository;
    private StringRedisTemplate stringRedisTemplate;
    private SimpMessagingTemplate template;
    @Setter
    private volatile boolean TleReady = false;

    @Autowired
    public SatellitePositionCalculationService(SatellieTleRepository satellieTleRepository, StringRedisTemplate stringRedisTemplate, SimpMessagingTemplate template) {
        this.satellieTleRepository = satellieTleRepository;
        this.stringRedisTemplate = stringRedisTemplate;
        this.template = template;
    }

    @Scheduled(fixedRate = 30000)
    public void calculatePositions() {
        if (!TleReady) {
            System.out.println("Tle Data not inserted yet");
            return;
        }
        List<SatelliteTle> satilliteList = satellieTleRepository.findAll();
        List<SatellitePositionDTO> positions = new ArrayList<>();
        File orekitData = new File("src/main/resources/orekit-data-main");
        DataContext.getDefault().getDataProvidersManager().addProvider(new DirectoryCrawler(orekitData));
        for (SatelliteTle sat : satilliteList) {
            TLE tle = new TLE(sat.getTle1(), sat.getTle2());
            TLEPropagator propagator = TLEPropagator.selectExtrapolator(tle);
            AbsoluteDate currentDate = new AbsoluteDate(new java.util.Date(), TimeScalesFactory.getUTC());
            Frame earthFrame = FramesFactory.getITRF(IERSConventions.IERS_2010, true);
            OneAxisEllipsoid earth = new OneAxisEllipsoid(Constants.WGS84_EARTH_EQUATORIAL_RADIUS,
                    Constants.WGS84_EARTH_FLATTENING,
                    earthFrame);
            PVCoordinates pvCoordinates = propagator.getPVCoordinates(currentDate, earthFrame);
            GeodeticPoint point = earth.transform(pvCoordinates.getPosition(), earthFrame, currentDate);

            double lat = Math.toDegrees(point.getLatitude());
            double lon = Math.toDegrees(point.getLongitude());
            double alt = (point.getAltitude() / 1000);

            String redisKey = "sat:" + sat.getSatilliteName();
            String redisValue = String.format("{\"name\":\"%s\",\"lat\":%.6f,\"lon\":%.6f,\"alt\":%.2f}", sat.getSatilliteName(), lat, lon, alt);
            stringRedisTemplate.opsForValue().set(redisKey, redisValue, 45, TimeUnit.SECONDS);

            SatellitePositionDTO position = new SatellitePositionDTO();
            position.setNoradID(sat.getNoradID());
            position.setSatelliteName(sat.getSatilliteName());
            position.setLatitude(lat);
            position.setLongitude(lon);
            position.setAltitude(alt);

            positions.add(position);
        }
        //System.out.println("Broadcasting " + positions.size() + " satellite positions to /topic/positions");
        System.out.println("Brodcasted " + count + "times");
        count++;
        template.convertAndSend("/topic/positions", positions);
    }
}
