/**
 * Seeds a small set of major oceans/seas as simplified reference polygons so
 * the Globe/GIS layer toggles have real MongoDB-backed geometry to render.
 *
 * IMPORTANT: these are hand-simplified illustrative bounding polygons, NOT
 * authoritative hydrographic boundaries. Every record's `source` field says
 * so explicitly, and the UI must surface that label rather than presenting
 * them as survey-grade GIS data. For production use, replace this seed with
 * a real licensed dataset (e.g. Natural Earth / marineregions.org VLIZ IHO
 * Sea Areas, both free with attribution) loaded via a proper GeoJSON import.
 *
 * Run with: npm run seed:water-bodies
 */
import mongoose from 'mongoose';
import { WaterBody, WaterBodySchema } from '../modules/water-bodies/schemas/water-body.schema';

const SOURCE_LABEL = 'SIMULATED DEMO DATA - simplified illustrative boundary (not survey-grade hydrography)';

const WATER_BODIES = [
  {
    name: 'Arabian Sea',
    type: 'SEA',
    region: 'Indian Ocean, India/Pakistan/Oman coast',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [50, 10],
          [50, 25],
          [77, 25],
          [77, 6],
          [50, 10],
        ],
      ],
    },
  },
  {
    name: 'Bay of Bengal',
    type: 'SEA',
    region: 'Indian Ocean, India/Bangladesh/Myanmar coast',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [78, 6],
          [78, 22],
          [95, 22],
          [95, 6],
          [78, 6],
        ],
      ],
    },
  },
  {
    name: 'Indian Ocean',
    type: 'OCEAN',
    region: 'Global',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [20, -60],
          [20, 30],
          [120, 30],
          [120, -60],
          [20, -60],
        ],
      ],
    },
  },
  {
    name: 'Pacific Ocean',
    type: 'OCEAN',
    region: 'Global',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [120, -60],
          [120, 60],
          [-70, 60],
          [-70, -60],
          [120, -60],
        ],
      ],
    },
  },
  {
    name: 'Atlantic Ocean',
    type: 'OCEAN',
    region: 'Global',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [-70, -60],
          [-70, 60],
          [20, 60],
          [20, -60],
          [-70, -60],
        ],
      ],
    },
  },
  {
    name: 'Mediterranean Sea',
    type: 'SEA',
    region: 'Southern Europe / North Africa',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [-6, 30],
          [-6, 45],
          [36, 45],
          [36, 30],
          [-6, 30],
        ],
      ],
    },
  },
];

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/marinevision';
  await mongoose.connect(uri);
  const WaterBodyModel = mongoose.model(WaterBody.name, WaterBodySchema);

  for (const wb of WATER_BODIES) {
    await WaterBodyModel.findOneAndUpdate(
      { name: wb.name },
      { ...wb, source: SOURCE_LABEL },
      { upsert: true, new: true },
    );
    // eslint-disable-next-line no-console
    console.log(`Seeded water body: ${wb.name}`);
  }

  await mongoose.disconnect();
  // eslint-disable-next-line no-console
  console.log('Water body seeding complete.');
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seeding failed:', err);
  process.exit(1);
});
