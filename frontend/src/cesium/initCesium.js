import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

// Log to verify
console.log('CESIUM_BASE_URL =', window.CESIUM_BASE_URL);
console.log('Ion token =', import.meta.env.VITE_CESIUM_ION_TOKEN);

// Set your Ion token
Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN;

export function createCesiumViewer(container) {
    console.log('Creating Viewer in', container);

    return new Cesium.Viewer(container, {
        terrainProvider: new Cesium.EllipsoidTerrainProvider(),
        animation: true,
        timeline: true,
        baseLayerPicker: true,
        geocoder: true,
        homeButton: true,
        fullscreenButton: true,
        sceneModePicker: true,
        navigationHelpButton: true
    });
}
