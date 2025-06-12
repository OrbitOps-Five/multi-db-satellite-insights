import { Link } from 'react-router-dom';

export default function HomePage() {
    return (
        <div style={{ padding: 20 }}>
            <h1>Satellite App</h1>
            <ul>
                <li><Link to="/forecast">Forecast Positions</Link></li>
                <li><Link to="/live">Live Position</Link></li>
                <li><Link to="/metadata">Satellite Metadata</Link></li>
                <li><Link to="/satellite-filter-congestion">Satellite Filter and Congestion</Link></li>
                <li><Link to="/graph">Graph View</Link></li>
                <li><Link to="/viewer">Constellation Viewer</Link></li>
            </ul>
        </div>
    );
}
