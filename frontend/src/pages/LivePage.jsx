import React, { useCallback, useRef, useState } from 'react';
import CesiumViewer from '../components/CesiumViewer';
import * as Cesium from 'cesium';
import SockJS from 'sockjs-client';
import Stomp from 'stompjs';

export default function LivePage() {
  const cesiumSatellites = useRef({});
  const satelliteStore = useRef({});
  const viewerRef = useRef(null);
  const orbitLineRef = useRef(null);
  const heightLineRef = useRef(null);
  const [selectedSatellite, setSelectedSatellite] = useState(null);

  const updateSatellite = useCallback((viewer, { id, name, lat, lon, alt }) => {
    const newPos = Cesium.Cartesian3.fromDegrees(lon, lat, alt * 1000);
    const now = Date.now();

    if (cesiumSatellites.current[id]) {
      const sat = cesiumSatellites.current[id];
      sat.from = sat.to || newPos;
      sat.to = newPos;
      sat.lastUpdate = now;
      return;
    }

    const satellite = {
      id,
      name,
      from: newPos,
      to: newPos,
      lastUpdate: now,
    };

    const entity = viewer.entities.add({
      id,
      name,
      position: new Cesium.CallbackProperty(() => {
        const t = (Date.now() - satellite.lastUpdate) / 30000;
        const clampedT = Math.min(t, 1.0);
        return Cesium.Cartesian3.lerp(
          satellite.from,
          satellite.to,
          clampedT,
          new Cesium.Cartesian3()
        );
      }, false),
      point: {
        pixelSize: 10,
        color: Cesium.Color.YELLOW,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 1,
      },
      label: {
        show: false,
        text: name,
        font: '16px sans-serif',
        fillColor: Cesium.Color.WHITE,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -12),
      },
    });

    cesiumSatellites.current[id] = { ...satellite, entity };
  }, []);

  const handleViewerReady = useCallback((viewer) => {
    cesiumSatellites.current = {};
    satelliteStore.current = {};
    viewer.entities.removeAll();
    viewerRef.current = viewer;

    const socket = new SockJS("http://localhost:8080/ws");
    const stompClient = Stomp.over(socket);

    stompClient.connect({}, frame => {
      console.log("✅ STOMP connected:", frame);

      stompClient.subscribe("/topic/positions", message => {
        const data = JSON.parse(message.body);

        data.forEach(sat => {
          satelliteStore.current[sat.noradID] = sat;
          updateSatellite(viewer, {
            id: sat.noradID,
            name: sat.satelliteName,
            lat: sat.latitude,
            lon: sat.longitude,
            alt: sat.altitude,
          });
        });
      });
    }, err => {
      console.error(" WebSocket connection failed:", err);
    });

    viewer.screenSpaceEventHandler.setInputAction(movement => {
      const picked = viewer.scene.pick(movement.position);
      if (Cesium.defined(picked) && picked.id) {
        const sat = satelliteStore.current[picked.id.id];
        if (sat) {
          setSelectedSatellite(sat);

          Object.values(cesiumSatellites.current).forEach(({ entity }) => {
            entity.point.color = Cesium.Color.YELLOW;
            entity.point.pixelSize = 10;
          });

          const selectedEntity = cesiumSatellites.current[sat.noradID]?.entity;
          if (selectedEntity) {
            selectedEntity.point.color = Cesium.Color.WHITE;
            selectedEntity.point.pixelSize = 16;
          }

          fetch(`http://localhost:8080/api/trajectory/${sat.noradID}`)
            .then(res => res.json())
            .then(data => {
              const positions = data.trajectory.map(pos =>
                Cesium.Cartesian3.fromDegrees(pos.longitude, pos.latitude, pos.altitude * 1000)
              );

              if (orbitLineRef.current) {
                viewer.entities.remove(orbitLineRef.current);
              }

              orbitLineRef.current = viewer.entities.add({
                id: `orbit-${sat.noradID}`,
                name: `${sat.satelliteName} Orbit`,
                polyline: {
                  positions,
                  width: 5,
                  material: Cesium.Color.WHITE.withAlpha(0.8),
                },
              });

              if (heightLineRef.current) {
                viewer.entities.remove(heightLineRef.current);
              }
              const groundPoint = Cesium.Cartesian3.fromDegrees(sat.longitude, sat.latitude, 0);
              const satellitePoint = Cesium.Cartesian3.fromDegrees(sat.longitude, sat.latitude, sat.altitude * 1000);
              heightLineRef.current = viewer.entities.add({
                id: `height-${sat.noradID}`,
                polyline: {
                  positions: [groundPoint, satellitePoint],
                  width: 2,
                  material: Cesium.Color.WHITE.withAlpha(0.8),
                },
              });
            });
        }
      } else {
        setSelectedSatellite(null);
        if (orbitLineRef.current) {
          viewer.entities.remove(orbitLineRef.current);
          orbitLineRef.current = null;
        }
        if (heightLineRef.current) {
          viewer.entities.remove(heightLineRef.current);
          heightLineRef.current = null;
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    viewer.screenSpaceEventHandler.setInputAction(movement => {
      const picked = viewer.scene.pick(movement.endPosition);
      viewer.entities.values.forEach(entity => {
        if (entity.label) entity.label.show = false;
      });
      if (Cesium.defined(picked) && picked.id && picked.id.label) {
        picked.id.label.show = true;
        picked.id.label.font = '18px sans-serif';
        picked.id.label.fillColor = Cesium.Color.WHITE;
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  }, [updateSatellite]);

  return (
    <div style={{ position: 'relative', height: '100vh' }}>
      <CesiumViewer
        onViewerReady={handleViewerReady}
        style={{ position: 'absolute', top: 0, bottom: 50, width: '100%' }}
      />

      {selectedSatellite && (
        <div style={{
          position: 'absolute',
          top: '40%',
          left: 0,
          transform: 'translateY(-50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          color: 'white',
          padding: '15px',
          fontSize: '15px',
          borderTopRightRadius: '10px',
          zIndex: 1000,
          width: '220px',
        }}>
          <strong>{selectedSatellite.satelliteName}</strong><br />
          NORAD: {selectedSatellite.noradID}<br />
          Lat: {selectedSatellite.latitude.toFixed(2)}<br />
          Lon: {selectedSatellite.longitude.toFixed(2)}<br />
          Alt: {selectedSatellite.altitude.toFixed(2)} km
        </div>
      )}
    </div>
  );
}
