import { useState, useEffect, useRef } from 'react';
import CesiumViewer from '../components/CesiumViewer';
import { fetchLaunchHistory } from '../services/api';
import * as satellite from 'satellite.js';

export default function LivePage() {
    const [launchData, setLaunchData] = useState([]);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [selectedType, setSelectedType] = useState('communication');
    const viewerRef = useRef(null);

    useEffect(() => {
        if (viewerRef.current) {
            loadSatellites(selectedType);
        }
    }, [selectedType]);

    const loadSatellites = async (type) => {
        const viewer = viewerRef.current;
        if (!viewer || !window.Cesium || !type) return;

        const Cesium = window.Cesium;
        const res = await fetch(`/api/satellites?type=${type}`);
        const satellites = await res.json();

        viewer.entities.removeAll();
        const satelliteEntities = [];

        satellites.forEach(({ name, tle_line1, tle_line2, type }) => {
            if (!tle_line1 || !tle_line2) return;

            const satrec = satellite.twoline2satrec(tle_line1, tle_line2);

            const entity = viewer.entities.add({
                name,
                position: new Cesium.CallbackProperty(() => {
                    const now = new Date();
                    const posVel = satellite.propagate(satrec, now);
                    if (!posVel.position) return null;

                    const gmst = satellite.gstime(now);
                    const geo = satellite.eciToGeodetic(posVel.position, gmst);
                    return Cesium.Cartesian3.fromDegrees(
                        Cesium.Math.toDegrees(geo.longitude),
                        Cesium.Math.toDegrees(geo.latitude),
                        geo.height * 1000
                    );
                }, false),
                point: {
                    pixelSize: 8,
                    color: Cesium.Color.CYAN,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 1,
                    heightReference: Cesium.HeightReference.NONE
                },
                description: `Type: ${type}`,
            });

            satelliteEntities.push(entity);
        });

        viewer.zoomTo(satelliteEntities);
    };

    const handleShowCongestion = async () => {
        const viewer = viewerRef.current;
        if (!viewer || !window.Cesium) return;

        const Cesium = window.Cesium;
        const res = await fetch('/api/orbit-heatmap');
        const data = await res.json();

        viewer.entities.removeAll();
        const satelliteEntities = [];

        Object.entries(data).forEach(([band, { satellites, congestion }]) => {
            const color = congestion === 'High'
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
                        const posVel = satellite.propagate(satrec, now);
                        if (!posVel.position) return null;

                        const gmst = satellite.gstime(now);
                        const geo = satellite.eciToGeodetic(posVel.position, gmst);
                        return Cesium.Cartesian3.fromDegrees(
                            Cesium.Math.toDegrees(geo.longitude),
                            Cesium.Math.toDegrees(geo.latitude),
                            geo.height * 1000
                        );
                    }, false),
                    point: {
                        pixelSize: 6,
                        color,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 1,
                        heightReference: Cesium.HeightReference.NONE
                    },
                    description: `Type: ${type}`,
                });

                satelliteEntities.push(entity);
            });
        });

        viewer.zoomTo(satelliteEntities);
    };

    const handleFetchLaunchHistory = async () => {
        try {
            const data = await fetchLaunchHistory();
            const results = Array.isArray(data?.results) ? data.results : [];
            setLaunchData(results);
            setSidebarOpen(true);
        } catch (error) {
            console.error('Failed to fetch launch history:', error);
            setLaunchData([]);
        }
    };
    
    const handleCloseSidebar = () => {
        setSidebarOpen(false);
        setLaunchData([]);
    };

    const handleTypeFilterChange = (event) => {
        setSelectedType(event.target.value);
    };

    const handleViewerReady = (viewer) => {
        viewerRef.current = viewer;
        loadSatellites(selectedType);
    };

    return (
        <div style={{ display: 'flex', height: '100vh' }}>
            {/* Sidebar */}
            <div
                style={{
                    width: sidebarOpen ? '300px' : '60px',
                    background: '#111',
                    color: '#fff',
                    transition: 'width 0.3s',
                    display: 'flex',
                    flexDirection: 'column',
                    zIndex: 1000
                }}
            >
                {!sidebarOpen ? (
                    <button
                        style={{
                            width: '100%',
                            padding: '5px',
                            background: '#222',
                            border: 'none',
                            color: '#fff',
                        }}
                        onClick={handleFetchLaunchHistory}
                    >
                        🚀
                    </button>
                ) : (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px' }}>
                            <strong>Launch History</strong>
                            <button
                                onClick={handleCloseSidebar}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#fff',
                                    fontSize: '16px',
                                    cursor: 'pointer',
                                }}
                            >
                                ✖
                            </button>
                        </div>
                        <div style={{ padding: '10px', overflowY: 'auto', maxHeight: 'calc(100vh - 60px)' }}>
                            {Array.isArray(launchData) && launchData.length > 0 ? (
                                launchData.map((launch, idx) => (
                                    <div
                                        key={idx}
                                        style={{
                                            marginBottom: '10px',
                                            borderBottom: '1px solid #444',
                                            paddingBottom: '5px',
                                        }}
                                    >
                                        <div><strong>Mission:</strong> {launch.mission || 'N/A'}</div>
                                        <div><strong>Launch Date:</strong> {launch.date ? new Date(launch.date).toLocaleDateString() : 'N/A'}</div>
                                        <div><strong>Rocket:</strong> {launch.rocket || 'N/A'}</div>
                                        <div><strong>Agency:</strong> {launch.provider || 'N/A'}</div>
                                    </div>
                                ))
                            ) : (
                                <div style={{ color: '#888' }}>No launch data available.</div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Filter UI */}
            <div style={{
                position: 'absolute',
                top: 10,
                left: sidebarOpen ? 320 : 80,
                zIndex: 2000,
                backgroundColor: '#222',
                color: '#fff',
                padding: '8px 12px',
                borderRadius: '8px',
                boxShadow: '0 0 5px rgba(0,0,0,0.3)',
                display: 'flex',
                gap: '10px',
                alignItems: 'center'
            }}>
                <label htmlFor="type-select">Filter:</label>
                <select
                    id="type-select"
                    value={selectedType}
                    onChange={handleTypeFilterChange}
                    style={{
                        backgroundColor: '#333',
                        color: '#fff',
                        border: '1px solid #666',
                        padding: '4px 8px',
                        borderRadius: '4px'
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
                        backgroundColor: '#555',
                        color: '#fff',
                        border: '1px solid #888',
                        borderRadius: '4px',
                        padding: '4px 10px',
                        cursor: 'pointer'
                    }}
                >
                    Show Congestion
                </button>
            </div>

            {/* Cesium Viewer */}
            <div style={{ flex: 1, position: 'relative' }}>
                <CesiumViewer
                    onViewerReady={handleViewerReady}
                    style={{ width: '100%', height: '100%' }}
                />
            </div>
        </div>
    );
}
