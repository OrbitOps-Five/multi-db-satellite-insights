package com.pramukh.adb.orbitops.Repository;

import com.pramukh.adb.orbitops.Model.SatelliteTle;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SatellieTleRepository extends MongoRepository<SatelliteTle, Long> {

}
