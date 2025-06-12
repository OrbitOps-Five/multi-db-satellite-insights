import { useState } from 'react';
import CesiumGraphView from '../components/CesiumGraphView';

export default function ViewerPage() {
  const [filters, setFilters] = useState({
    manufacturer: ''
  });

  const manufacturerOptions = ['SpaceX'];

  const handleChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  return (
    <div className="h-screen w-screen flex flex-col">
      <div className="p-4 bg-gray-100 flex flex-wrap gap-4 z-10">
      <Dropdown
         label="Manufacturer"
         name="manufacturer"
         options={manufacturerOptions}
         value={filters.manufacturer}
         onChange={handleChange}
       />
      </div>
      <div className="flex-1">
        <CesiumGraphView filters={filters} />
      </div>
    </div>
  );
}

const Dropdown = ({ label, name, options, value, onChange }) => (
  <label className="text-sm font-medium">
    {label}:{' '}
    <select name={name} value={value} onChange={onChange} className="ml-1 border rounded px-2 py-1">
      <option value="">All</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  </label>
);
