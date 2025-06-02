package com.pramukh.adb.orbitops.DTO;


public class SatellitePositionDTO {
    private long noradID;
    private String satelliteName;
    private double latitude;
    private double longitude;
    private double altitude;

    public long getNoradID() {
        return noradID;
    }

    public void setNoradID(long noradID) {
        this.noradID = noradID;
    }

    public String getSatelliteName() {
        return satelliteName;
    }

    public void setSatelliteName(String satelliteName) {
        this.satelliteName = satelliteName;
    }

    public double getLatitude() {
        return latitude;
    }

    public void setLatitude(double latitude) {
        this.latitude = latitude;
    }

    public double getLongitude() {
        return longitude;
    }

    public void setLongitude(double longitude) {
        this.longitude = longitude;
    }

    public double getAltitude() {
        return altitude;
    }

    public void setAltitude(double altitude) {
        this.altitude = altitude;
    }
}
