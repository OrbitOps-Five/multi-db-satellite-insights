import React, { useState, useEffect, useRef, useCallback } from 'react';
import CesiumViewer from '../components/CesiumViewer';
import * as Cesium from 'cesium';
import { fetchForecast } from '../services/api';

const AVAILABLE_SATS = [
    '25544', '48274', '49044', '49271',
    '53239', '54216', '61983', '62030',
    '63129', '63204', '63520', '63632'
];

export default function ForecastPage() {
    const [satId, setSatId] = useState(AVAILABLE_SATS[0]);
    const handlerRef = useRef(null);
    const viewerRef = useRef(null);

    const getForecast = useCallback(async () => {
        const now = Date.now();
        return fetchForecast(satId, now, now + 2 * 3600 * 1000);
    }, [satId]);

    const drawPath = useCallback((viewer, points) => {
        const existing = viewer.entities.getById(`track-${satId}`);
        if (existing) viewer.entities.remove(existing);

        const positions = points.map(pt =>
            Cesium.Cartesian3.fromDegrees(pt.lon, pt.lat, pt.alt * 1000)
        );

        viewer.entities.add({
            id: `track-${satId}`,
            polyline: {
                positions,
                width: 4,
                material: Cesium.Color.RED,
                arcType: Cesium.ArcType.GEODESIC,
            },
        });
    }, [satId]);

    const onViewerReady = useCallback(async viewer => {
        if (handlerRef.current) {
            handlerRef.current.destroy();
            handlerRef.current = null;
        }
        viewerRef.current = viewer;

        const points = await getForecast();
        if (!points.length) return;

        const sampledPos = new Cesium.SampledPositionProperty();
        points.forEach(pt => {
            const time = Cesium.JulianDate.fromDate(new Date(pt.ts));
            const pos = Cesium.Cartesian3.fromDegrees(pt.lon, pt.lat, pt.alt * 1000);
            sampledPos.addSample(time, pos);
        });

        const modelEntity = viewer.entities.add({
            id: `sat-${satId}`,
            name: `Sat ${satId}`,
            position: sampledPos,
            model: {
                uri: '/models/iss-c2/ISS-C2.glb',
                scale: 1000.0,
                minimumPixelSize: 512,
                maximumScale: 15000,
                runAnimations: true,
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 1e8),
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
            point: { pixelSize: 10, color: Cesium.Color.YELLOW, outlineColor: Cesium.Color.BLACK, outlineWidth: 2 },
        });

        drawPath(viewer, points);

        const startJ = Cesium.JulianDate.fromDate(new Date(points[0].ts));
        const endJ = Cesium.JulianDate.fromDate(new Date(points.at(-1).ts));
        viewer.clock.startTime = startJ.clone();
        viewer.clock.stopTime = endJ.clone();
        viewer.clock.currentTime = startJ.clone();
        viewer.clock.clockRange = Cesium.ClockRange.CLAMPED;
        viewer.clock.multiplier = 1;
        viewer.timeline.zoomTo(startJ, endJ);

        viewer.trackedEntity = modelEntity;

        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        handler.setInputAction(() => drawPath(viewer, points),
            Cesium.ScreenSpaceEventType.LEFT_CLICK
        );
        handlerRef.current = handler;
    }, [satId, getForecast, drawPath]);

    useEffect(() => {
        return () => {
            if (handlerRef.current) {
                handlerRef.current.destroy();
                handlerRef.current = null;
            }
            if (viewerRef.current) {
                viewerRef.current.destroy();
                viewerRef.current = null;
            }
        };
    }, []);

    return (
        <div >
            <div style={{
                position: 'absolute', top: 50, left: 80, zIndex: 1,
                background: 'rgba(0,0,0,0.6)', padding: '8px 12px', borderRadius: 4
            }}>
                <label style={{ color: 'white', marginRight: 8 }}>
                    Select Station:
                </label>
                <select
                    value={satId}
                    onChange={e => setSatId(e.target.value)}
                    style={{ padding: '4px 8px' }}
                >
                    {AVAILABLE_SATS.map(id => (
                        <option key={id} value={id}>
                            {id}
                        </option>
                    ))}
                </select>
            </div>

            <div style={{ position: 'absolute', top: 40, bottom: 0, left: 0, right: 0 }}>
                <CesiumViewer key={satId} onViewerReady={onViewerReady} />
            </div>
        </div>
    );
}
