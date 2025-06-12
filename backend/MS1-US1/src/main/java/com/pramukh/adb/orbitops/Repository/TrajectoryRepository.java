package com.pramukh.adb.orbitops.Repository;

import com.pramukh.adb.orbitops.Model.TrajectoryEntity;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;



@Repository
public interface TrajectoryRepository  extends MongoRepository<TrajectoryEntity,Long> {
    TrajectoryEntity findByNoradID(long noradID);
}
