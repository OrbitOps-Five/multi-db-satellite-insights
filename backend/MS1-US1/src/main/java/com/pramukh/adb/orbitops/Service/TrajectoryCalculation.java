package com.pramukh.adb.orbitops.Service;

import com.pramukh.adb.orbitops.DTO.SatellitePositionDTO;
import com.pramukh.adb.orbitops.Model.SatelliteTle;
import com.pramukh.adb.orbitops.Model.TrajectoryEntity;
import com.pramukh.adb.orbitops.Repository.SatellieTleRepository;
import com.pramukh.adb.orbitops.Repository.TrajectoryRepository;
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
import org.springframework.stereotype.Service;

import java.io.File;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
public class TrajectoryCalculation {

    private SatellieTleRepository satellieTleRepository;
    private TrajectoryRepository trajectoryRepository;
    @Autowired
    private SatellitePositionCalculationService satellitePositionCalculationService;

    @Autowired
    public TrajectoryCalculation(SatellieTleRepository satellieTleRepository, TrajectoryRepository trajectoryRepository) {
        this.satellieTleRepository = satellieTleRepository;
        this.trajectoryRepository = trajectoryRepository;
    }

    public void storeTracjectories() {
        System.out.println("Trajectory Started!!");
        File orekitData = new File("src/main/resources/orekit-data-main");
        DataContext.getDefault().getDataProvidersManager().addProvider(new DirectoryCrawler(orekitData));
        Frame earthFrame = FramesFactory.getITRF(IERSConventions.IERS_2010, true);
        OneAxisEllipsoid earth = new OneAxisEllipsoid(Constants.WGS84_EARTH_EQUATORIAL_RADIUS, Constants.WGS84_EARTH_FLATTENING, earthFrame);
        List<SatelliteTle> satellites = satellieTleRepository.findAll();
        for (SatelliteTle sat : satellites) {
            try {
                TLE tle = new TLE(sat.getTle1(), sat.getTle2());
                TLEPropagator propagator = TLEPropagator.selectExtrapolator(tle);
                AbsoluteDate startDate = new AbsoluteDate(new java.util.Date(), TimeScalesFactory.getUTC());
                List<SatellitePositionDTO> trajectorylist = new ArrayList<>();
                for (int i = 0; i <= 90; i++) {
                    AbsoluteDate futureDate = startDate.shiftedBy(i * 60.0);
                    PVCoordinates pv = propagator.getPVCoordinates(futureDate, earthFrame);
                    GeodeticPoint geo = earth.transform(pv.getPosition(), earthFrame, futureDate);

                    SatellitePositionDTO point = new SatellitePositionDTO();
                    point.setLatitude(Math.toDegrees(geo.getLatitude()));
                    point.setLongitude(Math.toDegrees(geo.getLongitude()));
                    point.setAltitude(geo.getAltitude() / 1000.0);

                    trajectorylist.add(point);
                }

                TrajectoryEntity entity = new TrajectoryEntity(sat.getNoradID(), sat.getSatilliteName(), trajectorylist);
                trajectoryRepository.save(entity);
                satellitePositionCalculationService.setTleReady(true);

            } catch (Exception e) {
                System.err.println("Error processing TLE for " + sat.getSatilliteName() + ": " + e.getMessage());
            }
        }
    }

    public TrajectoryEntity getTrajectoryByNoradId(long noradId) {
        return  trajectoryRepository.findByNoradID(noradId);
    }
}
