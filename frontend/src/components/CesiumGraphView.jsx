import { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import { createCesiumViewer } from '../cesium/initCesium';

const countryColors = {};

function getColorForCountry(country) {
  if (!country) return Cesium.Color.GRAY;
  if (!countryColors[country]) {
    const hue = Object.keys(countryColors).length * 45 % 360;
    countryColors[country] = Cesium.Color.fromHsl(hue / 360, 1.0, 0.5);
  }
  return countryColors[country];
}

export default function CesiumGraphView({ filters = {} }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });

  useEffect(() => {
    const viewer = createCesiumViewer(containerRef.current);
    viewerRef.current = viewer;
    console.log("Cesium Viewer initialized");

    return () => {
      viewer.destroy();
      viewerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
    const val = v?.trim();
    if (val && val !== "All") {
        params.append(k, val);
    }
});


    fetch(`/api/satellites/graph3d?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        console.log("Graph3D data:", data);
        setGraphData(data);
      });
  }, [filters]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    console.log("Removing all Cesium entities...");
    viewer.entities.removeAll();

    if (!graphData.nodes.length) return;

    const limitedNodes = graphData.nodes.slice(0, 500);
    console.log(`🛰 Rendering ${limitedNodes.length} nodes and ${graphData.links.length} links`);
    console.log("🛰 Nodes to render after filter:", limitedNodes.map(n => n.id));

    const nodeMap = {};
    limitedNodes.forEach((node) => {
      const pos = Cesium.Cartesian3.fromDegrees(node.lon, node.lat, node.alt);
      nodeMap[node.id] = pos;

      const country = node.country || 'N/A';
      const constellation = node.constellation || 'N/A';
      const manufacturer = node.manufacturer || 'N/A';

      viewer.entities.add({
        id: `sat-${node.id}`,
        name: node.id,
        position: pos,
        point: {
          pixelSize: 10,
          color: getColorForCountry(country),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1
        },
        label: {
          text: `${node.id}\n${country}\n${constellation}`.trim(),
          font: '12px sans-serif',
          showBackground: true,
          horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        },
        description: `
          <strong>${node.id}</strong><br/>
          Country: ${country}<br/>
          Manufacturer: ${manufacturer}<br/>
          Constellation: ${constellation}
        `
      });
    });

    graphData.links.forEach((link) => {
      const from = nodeMap[link.source];
      const to = nodeMap[link.target];
      if (from && to) {
        viewer.entities.add({
          polyline: {
            positions: [from, to],
            width: 2,
            material: Cesium.Color.ORANGE.withAlpha(0.7),
          }
        });
      }
    });

    try {
      const first = limitedNodes[0];
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(first.lon, first.lat, first.alt + 1000000)
      });
    } catch (e) {
      console.warn('Camera flyTo failed:', e);
    }
  }, [graphData]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
