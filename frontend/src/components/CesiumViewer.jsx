// client/src/components/CesiumViewer.jsx
import React, { useEffect, useRef } from 'react';
import { createCesiumViewer } from '../cesium/initCesium';

export default function CesiumViewer({ onViewerReady, style }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const viewer = createCesiumViewer(containerRef.current);
    if (onViewerReady) onViewerReady(viewer);

    return () => {
      viewer.destroy();
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
          zIndex: 1,
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
          width: '100%',
          height: '100%',
          margin: 0,
          padding: 0,
          ...style
        }}
      />
    </div>
  );
}
