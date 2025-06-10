import { useEffect, useState } from 'react';
import GraphView from '../components/GraphView';
import '../styles/GraphViewPage.css';
import axios from 'axios';

const GraphViewPage = () => {
  const [filters, setFilters] = useState({
    orbit: '',
    constellation: '',
    country: '',
    manufacturer: ''
  });

  const [options, setOptions] = useState({
    orbits: [],
    constellations: [],
    countries: [],
    manufacturers: []
  });

  useEffect(() => {
    axios.get('http://127.0.0.1:8000/api/satellites/options')
      .then(res => setOptions(res.data))
      .catch(err => console.error('Failed to fetch dropdown options', err));
  }, []);

  const handleChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  return (
    <div>
      <div className="filter-bar">
        <select name="orbit" value={filters.orbit} onChange={handleChange}>
          <option value="">All Orbits</option>
          {options.orbits.map(o => <option key={o} value={o}>{o}</option>)}
        </select>

        <select name="constellation" value={filters.constellation} onChange={handleChange}>
          <option value="">All Constellations</option>
          {options.constellations.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select name="country" value={filters.country} onChange={handleChange}>
          <option value="">All Countries</option>
          {options.countries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select name="manufacturer" value={filters.manufacturer} onChange={handleChange}>
          <option value="">All Manufacturers</option>
          {options.manufacturers.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <GraphView
        orbit={filters.orbit}
        constellation={filters.constellation}
        country={filters.country}
        manufacturer={filters.manufacturer}
      />
    </div>
  );
};

export default GraphViewPage;
