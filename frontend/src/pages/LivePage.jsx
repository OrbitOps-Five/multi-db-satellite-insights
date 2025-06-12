import React, { useCallback, useRef } from 'react';
import CesiumViewer from '../components/CesiumViewer';
import * as Cesium from 'cesium';
import SockJS from 'sockjs-client';
import Stomp from 'stompjs';

export default function LivePage() {
  const cesiumSatellites = useRef({});
  const satelliteStore = useRef({});
  const viewerReadyRef = useRef(null);

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
        font: '14px sans-serif',
        fillColor: Cesium.Color.WHITE,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -12),
      },
    });

    cesiumSatellites.current[id] = { ...satellite, entity };
  }, []);

  const renderSatellites = useCallback((viewer, data) => {
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
  }, [updateSatellite]);

  const handleViewerReady = useCallback((viewer) => {
    // Reset old state
    cesiumSatellites.current = {};
    viewer.entities.removeAll();
    viewerReadyRef.current = viewer;

    // ✅ Replay latest snapshot from localStorage
    const cached = localStorage.getItem("latestSatData");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        renderSatellites(viewer, parsed);
        console.log("✅ Re-rendered from localStorage");
      } catch (e) {
        console.warn("⚠️ Failed to parse cached satellite data");
      }
    }

    // 🔄 Connect WebSocket
    const socket = new SockJS("http://localhost:8080/ws");
    const stompClient = Stomp.over(socket);

    stompClient.connect({}, frame => {
      console.log("✅ STOMP connected:", frame);

      stompClient.subscribe("/topic/positions", message => {
        const data = JSON.parse(message.body);
        localStorage.setItem("latestSatData", JSON.stringify(data));
        renderSatellites(viewer, data);
      });
    }, err => {
      console.error("❌ WebSocket connection failed:", err);
    });

    // ℹ️ Popup on click
    viewer.screenSpaceEventHandler.setInputAction(movement => {
      const picked = viewer.scene.pick(movement.position);
      if (Cesium.defined(picked) && picked.id) {
        const sat = satelliteStore.current[picked.id.id];
        if (sat) {
          alert(
            `Name: ${sat.satelliteName}\nNORAD ID: ${sat.noradID}\nLat: ${sat.latitude.toFixed(2)}\nLon: ${sat.longitude.toFixed(2)}\nAlt: ${sat.altitude.toFixed(2)} km`
          );
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // 🖱️ Hover effect
    viewer.screenSpaceEventHandler.setInputAction(movement => {
      const picked = viewer.scene.pick(movement.endPosition);
      viewer.entities.values.forEach(entity => {
        if (entity.label) entity.label.show = false;
      });
      if (Cesium.defined(picked) && picked.id && picked.id.label) {
        picked.id.label.show = true;
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  }, [renderSatellites]);

  return (
    <CesiumViewer
      onViewerReady={handleViewerReady}
      style={{ position: 'absolute', top: 0, bottom: 0, width: '100%' }}
    />
  );
}
