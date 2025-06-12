import { useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import axios from 'axios';

const API_URL = 'http://127.0.0.1:8000/api/satellites/graph';

const GraphView = ({ orbit, constellation, country, manufacturer }) => {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });

  useEffect(() => {
    const params = new URLSearchParams();
    if (manufacturer) params.append('manufacturer', manufacturer);
    if (orbit) params.append('orbit', orbit);
    if (constellation) params.append('constellation', constellation);
    if (country) params.append('country', country);

    axios.get(`${API_URL}?${params.toString()}`)
      .then(res => {
        const data = res.data || {};
        setGraphData({
          nodes: data.nodes || [],
          links: data.links || []
        });
      })
      .catch(err => console.error("Failed to fetch graph data", err));
  }, [manufacturer, orbit, constellation, country]);

  return (
    <ForceGraph2D
      key={`${orbit}-${constellation}-${country}-${manufacturer}`}
      graphData={graphData}
      nodeAutoColorBy="id"
      nodeLabel="label"
      linkDirectionalArrowLength={4}
      linkDirectionalArrowRelPos={1}
    />
  );
};

export default GraphView;
