package com.pramukh.adb.orbitops.Model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

@Document(collection = "Satellite_TLE_Data")
public class SatelliteTle {
    @Id
    @Field("noradID")
    private Long NoradID;
    private String SatilliteName;
    private String tle1;
    private String tle2;



    public Long getNoradID() {
        return NoradID;
    }

    public void setNoradID(Long noradID) {
        NoradID = noradID;
    }

    public String getSatilliteName() {
        return SatilliteName;
    }

    public void setSatilliteName(String satilliteName) {
        SatilliteName = satilliteName;
    }

    public String getTle1() {
        return tle1;
    }

    public void setTle1(String tle1) {
        this.tle1 = tle1;
    }

    public String getTle2() {
        return tle2;
    }

    public void setTle2(String tle2) {
        this.tle2 = tle2;
    }
}
