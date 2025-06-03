const express = require('express');
const mongoose = require('mongoose');
const Redis = require('ioredis');
const axios = require('axios');
const cron = require('node-cron');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const mongoUri = process.env.MONGO_URI;
const redisUrl = process.env.REDIS_URL;
const tleApiUrl = process.env.TLE_API_URL;

const redis = new Redis(redisUrl);

// Test Redis connection
(async () => {
  try {
    const res = await redis.ping();
    console.log('Redis ping response:', res); // should log 'PONG'
    await redis.set('test-key', 'test-value');
    const testValue = await redis.get('test-key');
    console.log('Redis test value:', testValue);
  } catch (err) {
    console.error('Redis ping error:', err);
  }
})();

(async () => {
  try {
    const exists = await redis.exists('new-tles');
    if (!exists) {
      await redis.xadd('new-tles', '*', 'init', '1');
      console.log('Created new Redis stream: new-tles');
    } else {
      const info = await redis.xinfo('STREAM', 'new-tles');
      console.log('Redis stream info:', info);
    }
  } catch (err) {
    console.error('Redis stream error:', err);
  }
})();
// Also listen for connection events
redis.on('connect', () => console.log('Redis connected'));
redis.on('error', err => console.error('Redis error:', err));

mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => { console.log('MongoDB connected'), ingestTLEs() })
  .catch(err => console.error('MongoDB connection error:', err));

const TleSnapshotSchema = new mongoose.Schema({
  satId: String,
  tle1: String,
  tle2: String,
  createdAt: { type: Date, default: Date.now }
});

const ForecastPointSchema = new mongoose.Schema({
  satId: String,
  ts: Date,
  position: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: [Number]
  },
  altitudeKm: Number
});

const TleSnapshot = mongoose.model('TleSnapshot', TleSnapshotSchema);
const ForecastPoint = mongoose.model('ForecastPoint', ForecastPointSchema);

async function ingestTLEs() {
  console.log('Ingesting TLEs... called at', new Date().toISOString());
  try {
    const response = await axios.get(tleApiUrl);

    if (response.status !== 200) {
      throw new Error(`Failed to fetch TLEs: ${response.status} ${response.statusText}`);
    }
    // console.log('Received response from TLE API:', JSON.stringify(response.data).slice(0, 500));
    const tleData = response.data.split('\n').filter(line => line.trim());

    for (let i = 0; i < tleData.length; i += 3) {
      console.log(`Processing TLE for satellite: ${tleData[i].trim()}`);
      const satId = tleData[i].trim();
      const tle1 = tleData[i + 1].trim();
      const tle2 = tleData[i + 2].trim();

      const tleSnapshot = new TleSnapshot({ satId, tle1, tle2 });
      // await tleSnapshot.save();
      const pingResponse = await redis.ping();
      console.log('Redis ping response after saving TLE:', pingResponse); // should log 'PONG'

      // try {
      //   console.log('Before adding to Redis stream');
      //   await redis.xadd('new-tles', '*', 'satId', satId, 'snapshotId', tleSnapshot._id.toString());
      //   console.log('Added to Redis stream');
      // } catch (err) {
      //   console.error('Error adding message to Redis stream:', err);
      // }
    }
  } catch (error) {
    console.error('Error ingesting TLEs:', error);
  }
}

async function propagationLoop() {
  while (true) {
    const result = await redis.xread('BLOCK', 0, 'STREAMS', 'new-tles', '$');
    const messages = result[0][1];

    for (const message of messages) {
      const [id, fields] = message;
      const satId = fields[1];
      const snapshotId = fields[3];

      const tleSnapshot = await TleSnapshot.findById(snapshotId);
      const satrec = satellite.twoline2satrec(tleSnapshot.tle1, tleSnapshot.tle2);
      const points = [];

      for (let i = 0; i < 120; i++) {
        const ts = Date.now() + i * 60000; // 60 seconds intervals
        const positionAndVelocity = satellite.propagate(satrec, new Date(ts));
        const positionEci = positionAndVelocity.position;
        const positionGd = satellite.eciToGeodetic(positionEci, new Date(ts));

        points.push({
          satId,
          ts,
          position: {
            type: 'Point',
            coordinates: [positionGd.longitude * (180 / Math.PI), positionGd.latitude * (180 / Math.PI)]
          },
          altitudeKm: positionGd.height / 1000
        });
      }

      await ForecastPoint.insertMany(points);
      points.forEach(point => {
        redis.del(`forecast:${satId}`);
        redis.zadd(`forecast:${satId}`, point.ts, JSON.stringify(point));
        redis.expire(`forecast:${satId}`, 9000); // expire in 2.5 hours
      });
    }
  }
}


cron.schedule('*/10 * * * *', ingestTLEs);
propagationLoop();

app.get('/api/forecast/:satId', async (req, res) => {
  const { satId } = req.params;
  const now = Date.now();
  const start = req.query.start || now;
  const end = req.query.end || now + 7200000; // 2 hours

  try {
    const cachedForecast = await redis.zrangebyscore(`forecast:${satId}`, start, end);
    if (cachedForecast.length) {
      return res.json(cachedForecast.map(JSON.parse));
    }

    const forecastPoints = await ForecastPoint.find({
      satId,
      ts: { $gte: new Date(start), $lte: new Date(end) }
    }).sort('ts').lean();

    forecastPoints.forEach(point => {
      redis.zadd(`forecast:${satId}`, point.ts, JSON.stringify(point));
      redis.expire(`forecast:${satId}`, 9000); // expire in 2.5 hours
    });

    res.json(forecastPoints.map(point => ({
      ts: point.ts,
      lon: point.position.coordinates[0],
      lat: point.position.coordinates[1],
      alt: point.altitudeKm
    })));
  } catch (error) {
    console.error('Error fetching forecast:', error);
    res.status(500).send('Internal Server Error');
  }
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
  });
}

app.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});