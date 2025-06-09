import React, { useEffect, useRef } from 'react'
import { createCesiumViewer } from './cesium/initCesium'

export default function App() {
  const container = useRef(null)
  const viewer = useRef(null)

  useEffect(() => {
    // Initialize Cesium in the <div>
    viewer.current = createCesiumViewer(container.current)

    return () => {
      if (viewer.current) viewer.current.destroy()
    }
  }, [])

  return (
    <div
      ref={container}
      style={{ width: '100vw', height: '100vh', margin: 0, padding: 0 }}
    />
  )
}
