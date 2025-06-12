// client/src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ForecastPage from './pages/ForecastPage';
import LivePage from './pages/LivePage';
import SatelliteCongestionAndFilter from './pages/SatelliteCongestionAndFilter';

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ position: 'fixed', top: 40, bottom: 0, width: '100%' }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/forecast" element={<ForecastPage />} />
          <Route path="/live" element={<LivePage />} />
          <Route path="/satellite-filter-congestion" element={<SatelliteCongestionAndFilter />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
