import * as Cesium from "cesium";

// Log to verify
console.log("CESIUM_BASE_URL =", window.CESIUM_BASE_URL);
console.log("Ion token =", import.meta.env.VITE_CESIUM_ION_TOKEN);
window.CESIUM_BASE_URL = "/cesium";
// Set your Ion token
Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN;

export function createCesiumViewer(container) {
  console.log("Creating Viewer in", container);

  return new Cesium.Viewer(container, {
    // Option A: Use the high-resolution Cesium World Terrain
    terrainProvider: new Cesium.EllipsoidTerrainProvider({
      // assetId 1 is the standard global terrain
      assetId: 1,
    }),

    // Option B: If you don't have an Ion token, fallback to a smooth ellipsoid:
    // terrainProvider: new Cesium.EllipsoidTerrainProvider(),

    timeline: true,
    animation: true,
  });
}
