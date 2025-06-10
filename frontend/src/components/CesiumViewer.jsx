// client/src/components/CesiumViewer.jsx
import React, { useEffect, useRef } from 'react';
import { createCesiumViewer } from '../cesium/initCesium';

export default function CesiumViewer({ onViewerReady, style }) {
    const containerRef = useRef(null);
    const viewerRef = useRef(null);

    useEffect(() => {
        const viewer = createCesiumViewer(containerRef.current);
        viewerRef.current = viewer;
        if (onViewerReady) onViewerReady(viewer);

        return () => {
            viewer.destroy();
            viewerRef.current = null;
        };
    }, [onViewerReady]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <button
                onClick={() => window.history.back()}
                style={{
                    position: 'absolute',
                    top: 10,
                    left: 10,
                    zIndex: 1000,       // ensure button sits above the Cesium canvas
                    padding: '8px 12px',
                    background: '#fff',
                    border: '1px solid #ccc',
                    borderRadius: 4,
                    cursor: 'pointer',
                    color: '#333',
                }}
            >
                Back
            </button>
            <div
                ref={containerRef}
                style={{
                    position: 'absolute', // stack below the button
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    margin: 0,
                    padding: 0,
                    zIndex: 0,
                    ...style
                }}
            />
        </div>
    );
}
