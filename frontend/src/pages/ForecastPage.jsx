import CesiumViewer from '../components/CesiumViewer';
import * as Cesium from 'cesium';
import { fetchForecast } from '../services/api';

export default function ForecastPage() {
    const satId = '25544'; // ISS

    const onViewerReady = async (viewer) => {
        const points = await fetchForecast(satId);

        const prop = new Cesium.SampledPositionProperty();
        points.forEach(pt => {
            const t = Cesium.JulianDate.fromDate(new Date(pt.ts));
            const pos = Cesium.Cartesian3.fromDegrees(pt.lon, pt.lat, pt.alt * 1000);
            prop.addSample(t, pos);
        });
        const sat = viewer.entities.add({
            id: `sat-${satId}`,
            position: prop,
            point: { pixelSize: 8, color: Cesium.Color.YELLOW },
            label: { text: 'ISS', pixelOffset: new Cesium.Cartesian2(0, -20) }
        });

        const positions = points.map(pt =>
            Cesium.Cartesian3.fromDegrees(pt.lon, pt.lat, pt.alt * 1000)
        );
        viewer.entities.add({
            id: `track-${satId}`,
            polyline: {
                positions,
                width: 2,
                material: Cesium.Color.RED,
                arcType: Cesium.ArcType.GEODESIC
            }
        });

        const start = Cesium.JulianDate.fromDate(new Date(points[0].ts));
        const end = Cesium.JulianDate.fromDate(new Date(points.at(-1).ts));
        viewer.clock.startTime = start.clone();
        viewer.clock.stopTime = end.clone();
        viewer.clock.currentTime = start.clone();
        viewer.clock.clockRange = Cesium.ClockRange.CLAMPED;
        viewer.clock.multiplier = 1;
        viewer.timeline.zoomTo(start, end);

        viewer.zoomTo(sat).catch(() => { });
    };

    return (
        <CesiumViewer
            onViewerReady={onViewerReady}
            style={{ position: 'absolute', top: 0, bottom: 0, width: '100%' }}
        />
    );
}
