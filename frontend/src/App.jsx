// client/src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ForecastPage from './pages/ForecastPage';
import LivePage from './pages/LivePage';
import SatelliteCongestionAndFilter from './pages/SatelliteCongestionAndFilter';
import GraphViewPage from './pages/GraphViewPage';
import ViewerPage from './pages/ViewerPage';

export default function App() {
  return (
    <BrowserRouter>
      <div>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/forecast" element={<ForecastPage />} />
          <Route path="/live" element={<LivePage />} />
          <Route path="/satellite-filter-congestion" element={<SatelliteCongestionAndFilter />} />
          <Route path="/graph" element={<GraphViewPage />} />
          <Route path="/viewer" element={<ViewerPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
