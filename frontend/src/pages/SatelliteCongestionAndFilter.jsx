import { useState, useEffect, useRef } from 'react';
import CesiumViewer from '../components/CesiumViewer';
import { fetchLaunchHistory } from '../services/api';
import * as satellite from 'satellite.js';

export default function LivePage() {
  const [launchData, setLaunchData] = useState([]);
  const [decayData, setDecayData] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedType, setSelectedType] = useState('communication');
  const viewerRef = useRef(null);

  // store the alert location to draw circle & start polling
  const [alertLocation, setAlertLocation] = useState(null);
  const [alertMsg, setAlertMsg] = useState('');

  // poll every 10s once we've set an alertLocation
  useEffect(() => {
    if (!alertLocation) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/alerts/check?user_id=${encodeURIComponent(alertLocation.user_id)}`
        );
        const { msg } = await res.json();
        if (msg && msg !== 'No active alert') {
          clearInterval(interval);
          // show the popup
          alert(msg);
          setAlertMsg(msg);
          // optional: zoom into the alert location
          viewerRef.current.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
              alertLocation.lon,
              alertLocation.lat,
              2_000_000
            ),
          });
        }
      } catch (e) {
        console.error('check-alert failed', e);
      }
    }, 10_000);
    return () => clearInterval(interval);
  }, [alertLocation]);

  useEffect(() => {
    if (viewerRef.current) {
      loadSatellites(selectedType);
    }
  }, [selectedType]);

  const getDynamicPixelSize = (viewer) =>
    new Cesium.CallbackProperty(() => {
      const h = viewer.camera.positionCartographic.height;
      const s = 1.5e6 / (h + 1);
      return Math.min(Math.max(s, 3), 4);
    }, false);

  async function loadSatellites(type) {
    const viewer = viewerRef.current;
    if (!viewer || !window.Cesium || !type) return;
    const Cesium = window.Cesium;
    const sats = await fetch(`/api/satellites?type=${type}`).then((r) => r.json());
    viewer.entities.removeAll();
    const ents = [];
    for (const { name, tle_line1, tle_line2, type } of sats) {
      if (!tle_line1 || !tle_line2) continue;
      const satrec = satellite.twoline2satrec(tle_line1, tle_line2);
      const e = viewer.entities.add({
        name,
        position: new Cesium.CallbackProperty(() => {
          const now = new Date();
          const pv = satellite.propagate(satrec, now);
          if (!pv.position) return null;
          const gmst = satellite.gstime(now);
          const geo = satellite.eciToGeodetic(pv.position, gmst);
          return Cesium.Cartesian3.fromDegrees(
            Cesium.Math.toDegrees(geo.longitude),
            Cesium.Math.toDegrees(geo.latitude),
            geo.height * 1000
          );
        }, false),
        point: {
          color: Cesium.Color.CYAN,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1,
          pixelSize: getDynamicPixelSize(viewer),
        },
        description: `Type: ${type}`,
      });
      ents.push(e);
    }
    viewer.zoomTo(ents);
  }

  const handleShowCongestion = async () => {
    const viewer = viewerRef.current;
    if (!viewer || !window.Cesium) return;
    const Cesium = window.Cesium;
    const data = await fetch('/api/orbit-heatmap').then((r) => r.json());
    viewer.entities.removeAll();
    const ents = [];
    for (const [band, { satellites, congestion }] of Object.entries(data)) {
      const color =
        congestion === 'High'
          ? Cesium.Color.RED
          : congestion === 'Medium'
          ? Cesium.Color.YELLOW
          : Cesium.Color.GREEN;
      satellites.forEach(({ name, tle_line1, tle_line2, type }) => {
        if (!tle_line1 || !tle_line2) return;
        const satrec = satellite.twoline2satrec(tle_line1, tle_line2);
        const entity = viewer.entities.add({
          name,
          position: new Cesium.CallbackProperty(() => {
            const now = new Date();
            const pv = satellite.propagate(satrec, now);
            if (!pv.position) return null;
            const gmst = satellite.gstime(now);
            const geo = satellite.eciToGeodetic(pv.position, gmst);
            return Cesium.Cartesian3.fromDegrees(
              Cesium.Math.toDegrees(geo.longitude),
              Cesium.Math.toDegrees(geo.latitude),
              geo.height * 1000
            );
          }, false),
          point: {
            color,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 1,
            pixelSize: getDynamicPixelSize(viewer),
          },
          description: `Type: ${type}`,
        });
        ents.push(entity);
      });
    }
    viewer.zoomTo(ents);
  };

  const handleFetchLaunchHistory = async () => {
    const data = await fetchLaunchHistory();
    setLaunchData(Array.isArray(data.results) ? data.results : []);
    setDecayData([]);
    setSidebarOpen(true);
  };
  const handleFetchDecayData = async () => {
    const res = await fetch('/api/satellite-decay');
    const json = await res.json();
    setDecayData(Array.isArray(json.results) ? json.results : []);
    setLaunchData([]);
    setSidebarOpen(true);
  };
  const handleCloseSidebar = () => {
    setSidebarOpen(false);
    setLaunchData([]);
    setDecayData([]);
  };
  const handleTypeFilterChange = (e) => setSelectedType(e.target.value);

  function handleViewerReady(viewer) {
    viewerRef.current = viewer;
    loadSatellites(selectedType);
    const Cesium = window.Cesium;
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction(async (click) => {
      const cart = viewer.camera.pickEllipsoid(
        click.position,
        viewer.scene.globe.ellipsoid
      );
      if (!cart) return;
      const carto = Cesium.Cartographic.fromCartesian(cart);
      const lat = Cesium.Math.toDegrees(carto.latitude);
      const lon = Cesium.Math.toDegrees(carto.longitude);

      // draw pin
      viewer.entities.add({
        id: 'alert-pin',
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        billboard: {
          image:
            'https://cdn-icons-png.flaticon.com/512/684/684908.png',
          width: 32,
          height: 32,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        },
      });

      // draw 500 km circle
viewer.entities.add({
    id: 'alert-circle',
    position: Cesium.Cartesian3.fromDegrees(lon, lat),
    ellipse: {
      semiMajorAxis: 500000,
      semiMinorAxis: 500000,
      material: new Cesium.ColorMaterialProperty(
        Cesium.Color.RED.withAlpha(0.2)
      ),
      outline: true,
      outlineColor: Cesium.Color.RED,
    },
  });
  

      // register on backend
      try {
        const res = await fetch(
          '/api/alerts/register',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat, lon, user_id: 'admin' }),
          }
        );
        const json = await res.json();
        alert(json.msg);
        // kick off our poll-effect
        setAlertLocation({ lat, lon, user_id: 'admin' });
      } catch (err) {
        console.error('register failed', err);
        alert('Failed to set alert');
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar */}
      <div
        style={{
          width: sidebarOpen ? 300 : 60,
          background: '#111',
          color: '#fff',
          transition: 'width 0.3s',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1000,
          overflow: 'hidden',
        }}
      >
        {!sidebarOpen ? (
          <>
            <button
              style={{
                width: '100%',
                padding: 5,
                background: '#222',
                border: 'none',
                color: '#fff',
              }}
              onClick={handleFetchLaunchHistory}
            >
              🚀
            </button>
            <button
              style={{
                width: '100%',
                padding: 5,
                background: '#222',
                border: 'none',
                color: '#fff',
              }}
              onClick={handleFetchDecayData}
            >
              ☄️
            </button>
          </>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 10,
              }}
            >
              <strong>
                {launchData.length
                  ? 'Launch History'
                  : decayData.length
                  ? 'Recent Decays'
                  : ''}
              </strong>
              <button
                onClick={handleCloseSidebar}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontSize: 16,
                  cursor: 'pointer',
                }}
              >
                ✖
              </button>
            </div>
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: 10,
              }}
            >
              {launchData.map((l, i) => (
                <div
                  key={i}
                  style={{
                    marginBottom: 10,
                    borderBottom: '1px solid #444',
                    paddingBottom: 5,
                  }}
                >
                  <div>
                    <strong>Mission:</strong> {l.mission || 'N/A'}
                  </div>
                  <div>
                    <strong>Date:</strong>{' '}
                    {l.date
                      ? new Date(l.date).toLocaleDateString()
                      : 'N/A'}
                  </div>
                  <div>
                    <strong>Rocket:</strong> {l.rocket || 'N/A'}
                  </div>
                  <div>
                    <strong>Agency:</strong> {l.provider || 'N/A'}
                  </div>
                </div>
              ))}
              {decayData.map((d, i) => (
                <div
                  key={i}
                  style={{
                    marginBottom: 10,
                    borderBottom: '1px solid #444',
                    paddingBottom: 5,
                  }}
                >
                  <div>
                    <strong>Name:</strong> {d.name}
                  </div>
                  <div>
                    <strong>Decayed:</strong> {d.decay_date}
                  </div>
                  <div>
                    <strong>Launch:</strong> {d.launch_date}
                  </div>
                  <div>
                    <strong>Site:</strong> {d.launch_site}
                  </div>
                </div>
              ))}
              {!launchData.length && !decayData.length && (
                <div style={{ color: '#888' }}>No data available.</div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Filter */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: sidebarOpen ? 320 : 80,
          zIndex: 2000,
          background: '#222',
          color: '#fff',
          padding: '8px 12px',
          borderRadius: 8,
          boxShadow: '0 0 5px rgba(0,0,0,0.3)',
          display: 'flex',
          gap: 10,
          alignItems: 'center',
        }}
      >
        <label htmlFor="type-select">Filter:</label>
        <select
          id="type-select"
          value={selectedType}
          onChange={handleTypeFilterChange}
          style={{
            background: '#333',
            color: '#fff',
            border: '1px solid #666',
            padding: '4px 8px',
            borderRadius: 4,
          }}
        >
          <option value="">-- Select Type --</option>
          <option value="communication">Communication</option>
          <option value="earth_observation">Earth Observation</option>
          <option value="navigation">Navigation</option>
          <option value="scientific">Scientific</option>
          <option value="military">Military</option>
          <option value="cubesat">CubeSat</option>
        </select>
        <button
          onClick={handleShowCongestion}
          style={{
            background: '#555',
            color: '#fff',
            border: '1px solid #888',
            borderRadius: 4,
            padding: '4px 10px',
            cursor: 'pointer',
          }}
        >
          Show Congestion
        </button>
      </div>

      {/* Globe */}
      <div style={{ flex: 1, position: 'relative' }}>
        <CesiumViewer
          onViewerReady={handleViewerReady}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
}
