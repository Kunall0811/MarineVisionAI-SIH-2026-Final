import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { INestApplication } from '@nestjs/common';
import { UsersService } from '../modules/users/users.service';
import { SurveysService } from '../modules/surveys/surveys.service';
import { DetectionsService } from '../modules/detections/detections.service';
import { WaterBodiesService } from '../modules/water-bodies/water-bodies.service';
import { HistoricalService } from '../modules/historical/historical.service';
import { MemoryStore } from '../store/memoryStore';
import { USER_TARGET_DATA } from './seed-user-anomalies';

const WATER_BODIES = [
  {
    name: 'Arabian Sea',
    type: 'SEA' as const,
    region: 'Indian Ocean, India/Pakistan/Oman coast',
    geometry: {
      type: 'Polygon' as const,
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
    type: 'SEA' as const,
    region: 'Indian Ocean, India/Bangladesh/Myanmar coast',
    geometry: {
      type: 'Polygon' as const,
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
    type: 'OCEAN' as const,
    region: 'Global',
    geometry: {
      type: 'Polygon' as const,
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
    type: 'OCEAN' as const,
    region: 'Global',
    geometry: {
      type: 'Polygon' as const,
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
    type: 'OCEAN' as const,
    region: 'Global',
    geometry: {
      type: 'Polygon' as const,
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
    type: 'SEA' as const,
    region: 'Southern Europe / North Africa',
    geometry: {
      type: 'Polygon' as const,
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

export async function ensureStorageDirectories(basePath?: string): Promise<string> {
  const root = path.resolve(basePath || process.env.STORAGE_LOCAL_PATH || './data');
  const dirs = [
    root,
    path.join(root, 'uploads'),
    path.join(root, 'sonar'),
    path.join(root, 'datasets'),
    path.join(root, 'trained-models'),
    path.join(root, 'reports'),
    path.join(root, 'results'),
    path.join(root, 'surveys'),
    path.join(root, 'historical'),
  ];

  for (const d of dirs) {
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true });
    }
  }

  return root;
}

export async function seedAllDemoData(app: INestApplication): Promise<void> {
  const usersService = app.get(UsersService);
  const surveysService = app.get(SurveysService);
  const detectionsService = app.get(DetectionsService);
  const waterBodiesService = app.get(WaterBodiesService);
  const historicalService = app.get(HistoricalService);
  const store = app.get(MemoryStore);

  console.log('[Seed] Initializing demo data in MemoryStore...');

  // 1. Seed demo accounts
  const demoAccounts = [
    {
      fullName: process.env.DEMO_ADMIN_NAME || 'Admin Operator',
      email: (process.env.DEMO_ADMIN_EMAIL || 'admin@marinevision.ai').toLowerCase().trim(),
      password: process.env.DEMO_ADMIN_PASSWORD || 'Admin@12345',
      role: 'ADMIN' as const,
    },
    {
      fullName: process.env.DEMO_OPERATOR_NAME || 'Field Operator',
      email: (process.env.DEMO_OPERATOR_EMAIL || 'operator@marinevision.ai').toLowerCase().trim(),
      password: process.env.DEMO_OPERATOR_PASSWORD || 'Operator@12345',
      role: 'OPERATOR' as const,
    },
    {
      fullName: 'MarineVision Demo User',
      email: (process.env.DEMO_USER_EMAIL || 'demo@marinevision.ai').toLowerCase().trim(),
      password: process.env.DEMO_USER_PASSWORD || 'Demo@12345',
      role: 'ADMIN' as const,
    },
  ];

  let adminId = '';
  for (const acct of demoAccounts) {
    const existing = await usersService.findByEmail(acct.email);
    if (!existing) {
      const passwordHash = await bcrypt.hash(acct.password, 10);
      const user = await usersService.create({
        fullName: acct.fullName,
        email: acct.email,
        passwordHash,
        role: acct.role,
        isEmailVerified: true,
        isActive: true,
      });
      if (acct.role === 'ADMIN' && !adminId) adminId = user._id;
      console.log(`[Seed] Seeded demo user: ${acct.email} (${acct.role})`);
    } else if (acct.role === 'ADMIN' && !adminId) {
      adminId = existing._id;
    }
  }

  // 2. Seed water bodies
  for (const wb of WATER_BODIES) {
    await waterBodiesService.upsertByName(wb.name, {
      ...wb,
      source: 'Simplified reference hydrography boundary',
    });
  }
  console.log(`[Seed] Seeded ${WATER_BODIES.length} water bodies.`);

  // 3. Seed historical reference NOAA records
  const histResult = await historicalService.seedDefaults();
  console.log(`[Seed] Seeded ${histResult.upserted} NOAA historical reference records.`);

  // 4. Seed Survey and rich Anomalies
  const surveyCode = 'SURV-HIST-NOAA';
  let survey = await surveysService.findByCode(surveyCode);
  if (!survey) {
    survey = await surveysService.create({
      code: surveyCode,
      name: 'NOAA Cape Hatteras & Stellwagen Sonar Heritage Survey',
      waterBodyName: 'North Atlantic Ocean / Stellwagen Bank',
      region: 'US East Coast / Massachusetts Bay',
      status: 'COMPLETED',
      dataType: 'HISTORICAL',
      createdBy: adminId || 'admin-system',
      totalFrames: USER_TARGET_DATA.length,
      processedFrames: USER_TARGET_DATA.length,
      failedFrames: 0,
      route: {
        type: 'LineString',
        coordinates: [
          [-76.89499, 34.54479],
          [-75.801, 34.99012],
          [-75.11609, 35.39779],
          [-75.24941, 35.5441],
          [-74.8911, 35.62599],
          [-75.66833, 36.06464],
          [-75.209, 37.833],
          [-70.22443, 42.18208],
          [-70.29738, 42.31218],
          [-70.36982, 42.3726],
          [-70.45328, 42.40427],
        ],
      },
    });
    console.log(`[Seed] Seeded historical survey: ${survey.code}`);

    for (const t of USER_TARGET_DATA) {
      await detectionsService.create({
        surveyId: survey._id,
        anomalyCode: t.anomalyCode,
        targetName: t.targetName,
        detailedType: t.detailedType,
        class: t.class,
        confidence: t.confidence || 0.92,
        finalConfidence: t.confidence || 0.92,
        latitude: t.latitude,
        longitude: t.longitude,
        depth: t.depthMeters,
        depthFt: t.depthFt,
        sonarEvidence: t.sonarEvidence,
        length: t.dimensions.length,
        width: t.dimensions.width,
        height: t.dimensions.height,
        riskLevel: t.riskLevel as any,
        status: 'VERIFIED',
        locationStatus: 'REAL',
        dataType: 'HISTORICAL',
        coordinateSource: 'HISTORICAL_DATASET',
        historicalSource: `NOAA Sanctuary Maritime Heritage Archive · ${t.sonarEvidence}`,
        modelVersion: 'marine-yolo-v1-verified',
        bbox: { x1: 120, y1: 140, x2: 480, y2: 420 },
        location: {
          type: 'Point',
          coordinates: [t.longitude, t.latitude],
        },
      });
    }
    console.log(`[Seed] Seeded ${USER_TARGET_DATA.length} verified anomaly records.`);
  }

  console.log('[Seed] Demo data seeding complete. MemoryStore is ready.');
}
