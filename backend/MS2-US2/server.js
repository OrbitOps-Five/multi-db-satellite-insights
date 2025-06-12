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

const redisStream = createClient({ url: process.env.REDIS_URL });

redis.on('error', (err) => console.error('❌ Redis error:', err));

(async () => {
  await redis.connect();
  console.log('✅ Connected to Redis (node-redis)');
  await redisStream.connect();
  console.log('✅ Connected to Redis Stream Client');
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

forecastSchema.index({ position: '2dsphere' });

const TleSnapshot = mongoose.model('TleSnapshot', tleSchema);
const ForecastPoint = mongoose.model('ForecastPoint', forecastSchema);

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

cron.schedule('*/10 * * * *', fetchAndStoreTLEs);
fetchAndStoreTLEs().catch(console.error);

async function propagationLoop() {
  let lastId = '0-0';

  while (true) {
    try {
      const streams = await redisStream.xRead(
        [{ key: 'new-tles', id: lastId }],
        { BLOCK: 0, COUNT: 1 }
      );

      if (!streams || streams.length === 0) {
        continue;
      }

      const { messages } = streams[0];


      for (const msg of messages) {
        lastId = msg.id; // advance the last ID so we don’t re-read this message

        // msg.message is already an object: { satId: '25544', snapshotId: '...' }
        const { satId, snapshotId } = msg.message;

        // 4.2 Fetch the exact TLE document from MongoDB
        const tleDoc = await TleSnapshot.findById(snapshotId);
        if (!tleDoc) {
          // If the document was somehow deleted, skip it
          continue;
        }

        // 4.3 Create satrec from TLE lines using satellite.js
        const satrec = satellite.twoline2satrec(tleDoc.tle1, tleDoc.tle2);
        const now = new Date();

        // 4.4 Build array of forecast points (120 steps @ 60s each = 2 hours)
        const points = [];
        for (let s = 0; s <= 120 * 60; s += 60) {
          const t = new Date(now.getTime() + s * 1000);
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

        await ForecastPoint.insertMany(points);

        const zkey = `forecast:${satId}`;

        const multi = redis.multi();

        multi.del(zkey);

        for (const p of points) {
          multi.zAdd(zkey, {
            score: p.ts.getTime(),
            value: JSON.stringify({
              ts: p.ts.getTime(),
              lon: p.position.coordinates[0],
              lat: p.position.coordinates[1],
              alt: p.altitudeKm,
            }),
          });
        }
        // Keep this key alive for 2.5 hours (in seconds)
        multi.expire(zkey, 2.5 * 3600);

        await multi.exec();


        console.log(
          `[${new Date().toISOString()}] 🛰️  Propagated forecasts for sat=${satId}`
        );
      }
    } catch (err) {
      console.error('[Propagation Error]', err);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}
propagationLoop().catch(console.error);

app.get('/api/forecast/:satId', async (req, res) => {
  const { satId } = req.params;
  const now = Date.now();
  const start = Number(req.query.start) || now;
  const end = Number(req.query.end) || now + 2 * 3600 * 1000;
  const zkey = `forecast:${satId}`;

  console.log(`[API] Forecast request for satId=${satId}, start=${start}, end=${end}`);

  try {
    const cached = await redis.zRangeByScore(zkey, start, end);
    console.log(`[API] Redis zRangeByScore returned ${cached.length} items for key=${zkey}`);

    if (cached.length > 0) {
      console.log(`[API] Cache hit for satId=${satId}`);
      return res.json(cached.map(JSON.parse));
    }

    console.log(`[API] Cache miss for satId=${satId}, querying MongoDB...`);

    const docs = await ForecastPoint.find({
      satId,
      ts: { $gte: new Date(start), $lte: new Date(end) },
    })
      .sort('ts')
      .lean();

    console.log(`[API] MongoDB returned ${docs.length} documents for satId=${satId}`);

    // 5.3 Backfill Redis with these docs, if any
    if (docs.length > 0) {
      console.log(`[API] Backfilling Redis key=${zkey} with ${docs.length} docs`);
      const multi = redis.multi();
      multi.del(zkey);
      for (const d of docs) {
        multi.zAdd(zkey, {
          score: d.ts.getTime(),
          value: JSON.stringify({
            ts: d.ts.getTime(),
            lon: d.position.coordinates[0],
            lat: d.position.coordinates[1],
            alt: d.altitudeKm,
          }),
        });
      }
      multi.expire(zkey, 2.5 * 3600);
      await multi.exec();
      console.log(`[API] Redis backfill complete for key=${zkey}`);
    }

    const result = docs.map((d) => ({
      ts: d.ts.getTime(),
      lon: d.position.coordinates[0],
      lat: d.position.coordinates[1],
      alt: d.altitudeKm,
    }));
    console.log(`[API] Sending ${result.length} items from Mongo to client for satId=${satId}`);
    return res.json(result);

  } catch (err) {
    console.error(`[API Error] Forecast endpoint failed for satId=${satId}`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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