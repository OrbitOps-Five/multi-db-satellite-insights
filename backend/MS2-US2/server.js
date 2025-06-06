require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { createClient } = require('redis');
const axios = require('axios');
const cron = require('node-cron');
const satellite = require('satellite.js');
const cors = require('cors');
const path = require('path');


const app = express();
app.use(cors());
app.use(express.json());

const mongoUri = process.env.MONGO_URI;
const redisUrl = process.env.REDIS_URL;
const tleApiUrl = process.env.TLE_API_URL;


const redis = createClient({ url: redisUrl });

redis.on('error', (err) => console.error('❌ Redis error:', err));

(async () => {
  await redis.connect();
  console.log('✅ Connected to Redis (node-redis)');
})();


mongoose
  .connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => {
    console.error(' MongoDB connection error:', err);
    process.exit(1);
  });

const tleSchema = new mongoose.Schema(
  {
    satId: String,
    tle1: String,
    tle2: String,
    timestamp: { type: Date, default: Date.now },
  },
  { collection: 'tle_snapshots' }
);

const forecastSchema = new mongoose.Schema(
  {
    satId: String,
    ts: Date,
    position: { type: { type: String }, coordinates: [Number] }, // GeoJSON Point
    altitudeKm: Number,
  },
  { collection: 'satellite_forecasts' }
);

// Create 2dsphere index on position for future geo‐queries (optional)
forecastSchema.index({ position: '2dsphere' });

const TleSnapshot = mongoose.model('TleSnapshot', tleSchema);
const ForecastPoint = mongoose.model('ForecastPoint', forecastSchema);

// ─────────────────────────────────────────────────────────────
// 3. Ingestion Service (runs every 10 minutes via cron)
// ─────────────────────────────────────────────────────────────
async function fetchAndStoreTLEs() {
  try {
    const resp = await axios.get(process.env.TLE_API_URL);
    const lines = resp.data.trim().split('\n');

    for (let i = 0; i < lines.length; i += 3) {
      const name = lines[i].trim();
      const tle1 = lines[i + 1].trim();
      const tle2 = lines[i + 2].trim();
      const satId = tle1.slice(2, 7);

      const doc = await TleSnapshot.create({ satId, tle1, tle2 });
      console.log(`[${new Date().toISOString()}] 🛰️ before redis xadd for satId=${satId}`);

      // Using node-redis’s xAdd
      // Note: in node-redis v4, xAdd signature is: xAdd(key, id, mapObject)
      //    mapObject is an object with field:value pairs
      const xaddId = await redis.xAdd(
        'new-tles',
        '*',
        { satId, snapshotId: doc._id.toString() }
      );
      console.log(`[${new Date().toISOString()}] 🛰️ after redis xadd returned ID=${xaddId}`);
    }

    console.log(`[${new Date().toISOString()}] 🛰️ TLE ingestion complete`);
  } catch (err) {
    console.error('[Ingestion Error]', err.message);
  }
}

// Schedule cron job: “*/10 * * * *” → every 10 minutes
cron.schedule('*/10 * * * *', fetchAndStoreTLEs);
// Also run once immediately on startup
fetchAndStoreTLEs().catch(console.error);

// ─────────────────────────────────────────────────────────────
// 4. Propagation Worker (consumes Redis Stream, computes SGP4)
// ─────────────────────────────────────────────────────────────
async function propagationLoop() {
  let lastId = '0-0'; // read from the beginning the first time

  while (true) {
    try {
      // BLOCK until new entry arrives in the stream “new-tles”
      const streams = await redis.xread(
        'BLOCK',
        0,
        'STREAMS',
        'new-tles',
        lastId
      );
      if (!streams) continue;

      const [[, messages]] = streams;
      for (const [msgId, fields] of messages) {
        lastId = msgId; // update so we don’t re-read this message
        const data = {};
        for (let i = 0; i < fields.length; i += 2) {
          data[fields[i]] = fields[i + 1];
        }
        const { satId, snapshotId } = data;

        // 4.1 Fetch the exact TLE document from Mongo
        const tleDoc = await TleSnapshot.findById(snapshotId);
        if (!tleDoc) continue;

        // 4.2 Create satrec from TLE lines using satellite.js
        const satrec = satellite.twoline2satrec(tleDoc.tle1, tleDoc.tle2);
        const now = new Date();

        // 4.3 Build array of forecast points (120 steps @ 60s each = 2 hours)
        const points = [];
        for (let s = 0; s <= 120 * 60; s += 60) {
          const t = new Date(now.getTime() + s * 1000); // future time
          const eciPos = satellite.propagate(satrec, t).position;
          const gmst = satellite.gstime(t);
          const geo = satellite.eciToGeodetic(eciPos, gmst);
          const lon = satellite.degreesLong(geo.longitude);
          const lat = satellite.degreesLat(geo.latitude);
          const alt = geo.height; // in km

          points.push({
            satId,
            ts: t,
            position: { type: 'Point', coordinates: [lon, lat] },
            altitudeKm: alt,
          });
        }

        // 4.4 Bulk‐insert those points into MongoDB
        await ForecastPoint.insertMany(points);

        // 4.5 Cache the same points in Redis Sorted Set “forecast:<satId>”
        const zkey = `forecast:${satId}`;
        const pipeline = redis.pipeline();

        pipeline.del(zkey);
        for (const p of points) {
          pipeline.zadd(
            zkey,
            p.ts.getTime(), // use epoch ms as score
            JSON.stringify({
              ts: p.ts.getTime(),
              lon: p.position.coordinates[0],
              lat: p.position.coordinates[1],
              alt: p.altitudeKm,
            })
          );
        }
        // Keep this key alive for 2.5 hours (in seconds)
        pipeline.expire(zkey, 2.5 * 3600);
        await pipeline.exec();

        console.log(
          `[${new Date().toISOString()}] 🛰️  Propagated forecasts for sat=${satId}`
        );
      }
    } catch (err) {
      console.error('[Propagation Error]', err);
      // Wait 1 second before retrying on error
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}
propagationLoop().catch(console.error);


// GET /api/forecast/:satId?start=<ms>&end=<ms>
app.get('/api/forecast/:satId', async (req, res) => {
  try {
    const { satId } = req.params;
    const now = Date.now();
    const start = Number(req.query.start) || now;
    const end = Number(req.query.end) || now + 2 * 3600 * 1000;
    const zkey = `forecast:${satId}`;

    // 5.1 Try to read from Redis Sorted Set
    let cached = await redis.zrangebyscore(zkey, start, end);
    if (cached && cached.length > 0) {
      // Parse each JSON string into an object
      return res.json(cached.map(JSON.parse));
    }

    // 5.2 Fallback: query MongoDB
    const docs = await ForecastPoint.find({
      satId,
      ts: { $gte: new Date(start), $lte: new Date(end) },
    })
      .sort('ts')
      .lean();

    // 5.3 Backfill Redis with these docs
    if (docs.length > 0) {
      const pipe = redis.pipeline();
      pipe.del(zkey);
      for (const d of docs) {
        pipe.zadd(
          zkey,
          d.ts.getTime(),
          JSON.stringify({
            ts: d.ts.getTime(),
            lon: d.position.coordinates[0],
            lat: d.position.coordinates[1],
            alt: d.altitudeKm,
          })
        );
      }
      pipe.expire(zkey, 2.5 * 3600);
      await pipe.exec();
    }

    // 5.4 Return the forecast from Mongo
    return res.json(
      docs.map((d) => ({
        ts: d.ts.getTime(),
        lon: d.position.coordinates[0],
        lat: d.position.coordinates[1],
        alt: d.altitudeKm,
      }))
    );
  } catch (err) {
    console.error('[API Error]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// 6. Serve React Build in Production
// ─────────────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, 'client', 'build');
  app.use(express.static(clientBuildPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

app.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});