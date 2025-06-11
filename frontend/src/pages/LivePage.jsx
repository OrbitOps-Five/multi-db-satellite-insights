import { useState } from 'react';
import CesiumViewer from '../components/CesiumViewer';
import { fetchLaunchHistory } from '../services/api';

export default function LivePage() {
    const [launchData, setLaunchData] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const handleFetchLaunchHistory = async () => {
        try {
            const data = await fetchLaunchHistory();
            setLaunchData(data);
            setSidebarOpen(true);
        } catch (error) {
            console.error('Failed to fetch launch history:', error);
        }
    };

    const handleCloseSidebar = () => {
        setSidebarOpen(false);
        setLaunchData(null);
    };

    const handleViewerReady = async (viewer) => {
        try {
            if (!window.Cesium || !viewer || !viewer.entities) {
                console.error("Cesium or viewer is not ready.");
                return;
            }
    
            const Cesium = window.Cesium;
            const res = await fetch('/api/orbit-heatmap');
            const data = await res.json();
    
            Object.entries(data).forEach(([band, { satellites, congestion }]) => {
                const color = congestion === 'High'
                    ? Cesium.Color.RED
                    : congestion === 'Medium'
                    ? Cesium.Color.YELLOW
                    : Cesium.Color.GREEN;
    
                satellites.forEach(({ altitude, name }) => {
                    const randomLongitude = Math.random() * 360 - 180;
                    const randomLatitude = Math.random() * 180 - 90;
    
                    console.log(`Adding satellite: ${name} at ${altitude}km → (${randomLatitude}, ${randomLongitude})`);
    
                    viewer.entities.add({
                        name,
                        position: Cesium.Cartesian3.fromDegrees(randomLongitude, randomLatitude, altitude * 1000),
                        point: {
                            pixelSize: 10,
                            color: color,
                            outlineColor: Cesium.Color.BLACK,
                            outlineWidth: 2,
                            heightReference: Cesium.HeightReference.NONE
                        },
                        description: `Altitude: ${altitude} km`,
                    });
                });
            });
    
            viewer.zoomTo(viewer.entities);
        } catch (err) {
            console.error('Failed to load orbit heatmap data:', err);
        }
    };
    

    return (
        <div style={{ display: 'flex', height: '100vh' }}>
            <div
                style={{
                    width: sidebarOpen ? '300px' : '60px',
                    background: '#111',
                    color: '#fff',
                    transition: 'width 0.3s',
                    display: 'flex',
                    flexDirection: 'column',
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
                        <div style={{ padding: '10px', overflowY: 'auto', maxHeight: 'calc(100vh - 50px)' }}>
                            {launchData &&
                                launchData.map((launch, idx) => (
                                    <div
                                        key={idx}
                                        style={{
                                            marginBottom: '10px',
                                            borderBottom: '1px solid #444',
                                            paddingBottom: '5px',
                                        }}
                                    >
                                        <div><strong>Mission:</strong> {launch.mission}</div>
                                        <div><strong>Launch Date:</strong> {new Date(launch.date).toLocaleDateString()}</div>
                                        <div><strong>Rocket:</strong> {launch.rocket}</div>
                                        <div><strong>Agency:</strong> {launch.provider}</div>
                                    </div>
                                ))}
                        </div>
                    </>
                )}
            </div>

            <div style={{ flex: 1 }}>
                <CesiumViewer
                    onViewerReady={handleViewerReady}
                    style={{ position: 'absolute', top: 0, bottom: 0, width: '100%' }}
                />
            </div>
        </div>
    );
}