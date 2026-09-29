import * as crypto from 'crypto';

export function generateId(): string {
  return crypto.randomBytes(12).toString('hex');
}

export interface BaseEntity {
  _id: string;
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
  [key: string]: any;
}

export interface User extends BaseEntity {
  fullName: string;
  email: string;
  passwordHash: string;
  role: 'ADMIN' | 'OPERATOR';
  isEmailVerified: boolean;
  emailVerificationTokenHash?: string | null;
  emailVerificationExpires?: Date | null;
  passwordResetTokenHash?: string | null;
  passwordResetExpires?: Date | null;
  refreshTokenHash?: string | null;
  isActive: boolean;
  operatorPermissions?: {
    canUpload: boolean;
    canProcess: boolean;
    canVerifyDetections: boolean;
    canGenerateReports: boolean;
  };
  lastLoginAt?: Date | null;
}

export interface Survey extends BaseEntity {
  code: string;
  name: string;
  waterBodyName?: string;
  region?: string;
  status: 'DRAFT' | 'ACTIVE' | 'PROCESSING' | 'COMPLETED' | 'ARCHIVED' | string;
  dataType: 'LIVE' | 'HISTORICAL' | 'SYNTHETIC' | string;
  assignedOperators: string[];
  totalFrames: number;
  processedFrames: number;
  failedFrames: number;
  route: {
    type: 'LineString';
    coordinates: number[][]; // [lng, lat]
  };
  notes?: string;
  createdBy: string;
}

export interface SonarFrame extends BaseEntity {
  surveyId: string;
  fileName: string;
  storagePath: string;
  fileType: string;
  fileSizeBytes: number;
  fileHash: string;
  width: number;
  height: number;
  frequencyKhz?: number;
  range: number;
  side: 'PORT' | 'STARBOARD' | 'BOTH' | 'UNKNOWN' | string;
  latitude?: number | null;
  longitude?: number | null;
  heading?: number | null;
  depth?: number | null;
  altitude?: number | null;
  heave?: number | null;
  pitch?: number | null;
  roll?: number | null;
  motionCorrectionStatus: 'NONE' | 'PARTIAL' | 'FULL' | string;
  navigationSource: 'REAL' | 'ESTIMATED' | 'INTERPOLATED' | 'NONE' | string;
  processingStatus: 'PENDING' | 'PREPROCESSING' | 'INFERENCE' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'INVALID_INPUT' | string;
  processingError?: string;
  dropoutRatio?: number;
  processedAt?: Date;
  domainValidity?: {
    isSonarLike: boolean;
    sonarProbability: number;
    reasons: string[];
  };
  detectionCount: number;
  maxRiskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  timestamp?: Date;
}

export interface Detection extends BaseEntity {
  surveyId: string;
  sonarFrameId?: string | null;
  anomalyCode: string;
  targetName?: string;
  detailedType?: string;
  class: string;
  confidence: number;
  finalConfidence: number;
  shadowScore?: number;
  latitude?: number | null;
  longitude?: number | null;
  depth?: number | null;
  depthFt?: string | null;
  sonarEvidence?: string | null;
  length?: number;
  width?: number;
  height?: number;
  bbox?: { x1: number; y1: number; x2: number; y2: number };
  location?: {
    type: 'Point';
    coordinates: number[]; // [lng, lat]
  } | null;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  status: 'PENDING_REVIEW' | 'NEEDS_REVIEW' | 'VERIFIED' | 'REJECTED' | string;
  locationStatus: 'REAL' | 'ESTIMATED' | 'UNAVAILABLE' | string;
  dataType: 'LIVE' | 'HISTORICAL' | 'SYNTHETIC' | string;
  coordinateSource?: string;
  historicalSource?: string;
  modelVersion: string;
  verifiedBy?: string;
  verifiedAt?: Date;
  reviewComment?: string;
  imageUrl?: string;
}

export interface Report extends BaseEntity {
  surveyId: string;
  surveyCode: string;
  format: 'PDF' | 'JSON' | 'CSV' | 'GEOJSON' | string;
  fileName: string;
  storagePath: string;
  fileSizeBytes: number;
  detectionCount: number;
  generatedBy: string;
  emailedTo?: string[];
}

export interface Notification extends BaseEntity {
  recipientId?: string | null;
  type: string;
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  isRead: boolean;
  metadata?: Record<string, any>;
}

export interface WaterBody extends BaseEntity {
  name: string;
  type: 'OCEAN' | 'SEA' | 'BAY' | 'GULF' | 'STRAIT' | string;
  region?: string;
  geometry: {
    type: 'Polygon';
    coordinates: number[][][]; // GeoJSON polygon
  };
  source?: string;
}

export interface AuditLog extends BaseEntity {
  userId: string;
  userEmail: string;
  userRole: 'ADMIN' | 'OPERATOR' | string;
  action: string;
  category: string;
  targetType?: string;
  targetId?: string | null;
  metadata?: Record<string, any>;
  ipAddress?: string;
  outcome?: 'SUCCESS' | 'FAILED' | 'DENIED' | string;
}

export interface EmailLog extends BaseEntity {
  to: string;
  subject: string;
  triggerEvent: string;
  status: 'SENT' | 'FAILED' | 'LOGGED_ONLY' | string;
  messageId?: string;
  metadata?: Record<string, any>;
}

export interface EmailRecipient extends BaseEntity {
  email: string;
  name: string;
  agency?: string;
  organization?: string;
  subscribedEvents: string[];
  isActive: boolean;
}

export interface HistoricalReference extends BaseEntity {
  sourceId: string;
  name: string;
  type: string;
  eventYear?: number;
  eventDate?: string;
  latitude: number;
  longitude: number;
  depthMeters?: number;
  quantity?: number;
  description?: string;
  sourceOrganization?: string;
  sourceUrl?: string;
  coordinateAccuracy?: string;
  dataStatus?: string;
  tags?: string[];
}

export interface FridayInteraction extends BaseEntity {
  userId: string;
  userRole: 'ADMIN' | 'OPERATOR' | string;
  rawUtterance: string;
  transcriptionConfidence?: number;
  intent: string;
  intentConfidence: number;
  parameters: Record<string, any>;
  actionExecuted?: string;
  spokenResponse?: string;
  status: 'EXECUTED' | 'REJECTED' | 'FAILED' | 'PENDING_CONFIRMATION' | string;
  executionDurationMs?: number;
  resultData?: any;
  transcript?: string;
}

export interface TrainingJob extends BaseEntity {
  datasetId: string;
  hyperparameters: {
    epochs: number;
    learningRate: number;
    batchSize: number;
    valSplit: number;
    testSplit: number;
    useAugmentation: boolean;
    architecture: string;
    [key: string]: any;
  };
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | string;
  progressPct?: number;
  metrics?: Record<string, any>;
  resultingModelVersionId?: string;
  logLines?: string[];
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdBy: string;
}

export interface Dataset extends BaseEntity {
  name: string;
  description?: string;
  classes: string[];
  status: 'DRAFT' | 'SPLIT' | 'LOCKED' | 'ARCHIVED' | string;
  imageCount: number;
  createdBy: string;
}

export interface DatasetImage extends BaseEntity {
  datasetId: string;
  storagePath: string;
  fileName: string;
  label: string;
  split: 'TRAIN' | 'VAL' | 'TEST' | 'UNASSIGNED' | string;
  metadata?: Record<string, any>;
}

export interface ModelVersion extends BaseEntity {
  version: string;
  architecture: string;
  datasetId: string;
  trainingJobId: string;
  metricsSnapshot?: Record<string, any>;
  classLabels: string[];
  featureNames: string[];
  weightsStoragePath: string;
  onnxStoragePath: string;
  qualityState: 'EXPERIMENTAL' | 'VALIDATED' | 'PRODUCTION_CANDIDATE' | 'ACTIVE' | string;
  isActive: boolean;
  createdBy: string;
}
