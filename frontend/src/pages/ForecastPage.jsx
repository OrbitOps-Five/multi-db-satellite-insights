import React, { useEffect, useRef } from 'react';
import CesiumViewer from '../components/CesiumViewer';
import * as Cesium from 'cesium';
import { fetchForecast } from '../services/api';

export default function ForecastPage() {
    const handlerRef = useRef(null);
    const pathEntityRef = useRef(null);


    const satId = '25544';

    // 25544
    async function drawForecastPath(viewer, satId) {
        if (pathEntityRef.current) {
            viewer.entities.remove(pathEntityRef.current);
            pathEntityRef.current = null;
        }
        const points = await fetchForecast(satId);
        if (!points.length) return;

        const positions = points.map((pt) =>
            Cesium.Cartesian3.fromDegrees(pt.lon, pt.lat, pt.alt * 1000)
        );

        const entity = viewer.entities.add({
            id: `path-${satId}`,
            polyline: {
                positions,
                width: 3,
                material: Cesium.Color.RED,
                arcType: Cesium.ArcType.GEODESIC,
            },
        });
        pathEntityRef.current = entity;
        viewer.zoomTo(entity).catch(() => { });
    }

    const onViewerReady = async (viewer) => {
        // 1) Fetch 2h forecast to initialize everything
        const points = await fetchForecast(satId);
        if (!points.length) return;

        // 2) Add moving satellite entity
        const positionProp = new Cesium.SampledPositionProperty();
        points.forEach((pt) => {
            const time = Cesium.JulianDate.fromDate(new Date(pt.ts));
            const pos = Cesium.Cartesian3.fromDegrees(pt.lon, pt.lat, pt.alt * 1000);
            positionProp.addSample(time, pos);
        });
        const satEntity = viewer.entities.add({
            id: `sat-${satId}`,
            name: 'Satellite ' + satId,
            position: positionProp,
            point: {
                pixelSize: 8,
                color: Cesium.Color.YELLOW,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 1,
            },
            label: {
                text: 'ISS',
                font: '14pt sans-serif',
                fillColor: Cesium.Color.WHITE,
                pixelOffset: new Cesium.Cartesian2(0, -20),
            },
        });

        // 3) Draw red ground-track polyline
        const trackPositions = points.map((pt) =>
            Cesium.Cartesian3.fromDegrees(pt.lon, pt.lat, pt.alt * 1000)
        );
        viewer.entities.add({
            id: `track-${satId}`,
            polyline: {
                positions: trackPositions,
                width: 2,
                material: Cesium.Color.RED,
                arcType: Cesium.ArcType.GEODESIC,
            },
        });

        // 4) Add green-dot markers every 5th point (~5min steps)
        const markerDs = new Cesium.CustomDataSource(`markers-${satId}`);
        points.forEach((pt, idx) => {
            if (idx % 5 !== 0) return; // skip 4 out of 5
            markerDs.entities.add({
                position: Cesium.Cartesian3.fromDegrees(
                    pt.lon,
                    pt.lat,
                    pt.alt * 1000
                ),
                billboard: {
                    image: makeDotImage(),
                    scale: 0.6,
                    verticalOrigin: Cesium.VerticalOrigin.CENTER,
                },
            });
        });
        viewer.dataSources.add(markerDs);

        // 5) Configure clock & timeline for the 2h window
        const startJ = Cesium.JulianDate.fromDate(new Date(points[0].ts));
        const endJ = Cesium.JulianDate.fromDate(
            new Date(points[points.length - 1].ts)
        );
        const clock = viewer.clock;
        clock.startTime = startJ.clone();
        clock.stopTime = endJ.clone();
        clock.currentTime = startJ.clone();
        clock.clockRange = Cesium.ClockRange.CLAMPED;
        clock.multiplier = 1;
        viewer.timeline.zoomTo(startJ, endJ);

        // 6) Click handler: re-draw path on click of the satellite icon
        const handler = new Cesium.ScreenSpaceEventHandler(
            viewer.scene.canvas
        );
        handler.setInputAction((click) => {
            const picked = viewer.scene.pick(click.position);
            if (!Cesium.defined(picked) || !picked.id) return;
            const id = picked.id.id;
            if (id === `sat-${satId}`) {
                drawForecastPath(viewer, satId);
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        handlerRef.current = handler;

        // 7) Initial zoom to satellite
        viewer.zoomTo(satEntity).catch(() => { });
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (handlerRef.current) {
                handlerRef.current.destroy();
                handlerRef.current = null;
            }
        };
    }, []);

    return (
        <div
            style={{ position: 'fixed', top: 40, bottom: 0, left: 0, right: 0 }}
        >
            <CesiumViewer onViewerReady={onViewerReady} />
        </div>
    );
}

// Helper: small green dot for markers
function makeDotImage() {
    const size = 16;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 1, 0, 2 * Math.PI);
    ctx.fillStyle = 'lime';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'black';
    ctx.stroke();
    return canvas.toDataURL();
}