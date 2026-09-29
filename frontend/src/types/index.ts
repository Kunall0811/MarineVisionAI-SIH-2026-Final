export type UserRole = 'ADMIN' | 'OPERATOR';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  operatorPermissions?: {
    canUpload: boolean;
    canProcess: boolean;
    canVerifyDetections: boolean;
    canGenerateReports: boolean;
  };
}

export type DataType = 'LIVE' | 'HISTORICAL';
export type LocationStatus = 'REAL' | 'ESTIMATED' | 'UNAVAILABLE';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type DetectionStatus = 'PENDING_REVIEW' | 'VERIFIED' | 'REJECTED' | 'NEEDS_REVIEW';

export interface Survey {
  _id: string;
  code: string;
  name: string;
  description?: string;
  waterBodyName?: string;
  region?: string;
  status: 'PLANNED' | 'ACTIVE' | 'PROCESSING' | 'COMPLETED' | 'ARCHIVED';
  dataType: DataType;
  historicalSource?: string | null;
  totalFrames: number;
  processedFrames: number;
  failedFrames: number;
  route: { type: string; coordinates: [number, number][] };
  createdAt: string;
}

export interface Detection {
  _id: string;
  anomalyCode: string;
  surveyId: string;
  sonarFrameId: string;
  class: string;
  confidence: number;
  finalConfidence: number;
  bbox: { x1: number; y1: number; x2: number; y2: number };
  latitude: number | null;
  longitude: number | null;
  depth: number | null;
  length: number | null;
  width: number | null;
  artificialProbability: number;
  naturalProbability: number;
  shadowScore: number;
  noiseScore: number;
  riskLevel: RiskLevel;
  status: DetectionStatus;
  modelVersion: string;
  locationStatus: LocationStatus;
  dataType: DataType;
  historicalSource?: string | null;
  createdAt: string;
}

export interface SonarFrame {
  _id: string;
  surveyId: string;
  fileName: string;
  storagePath: string;
  fileType: string;
  latitude: number | null;
  longitude: number | null;
  processingStatus: 'QUEUED' | 'PREPROCESSING' | 'INFERENCE' | 'COMPLETED' | 'FAILED' | 'INVALID_INPUT';
  processingError?: string | null;
  navigationSource: LocationStatus;
  imageWidth: number | null;
  imageHeight: number | null;
  uploadedByRole?: 'ADMIN' | 'OPERATOR';
  reviewStatus?: 'APPROVED' | 'PENDING_REVIEW' | 'REJECTED' | 'CORRECTED';
  domainValidity?: {
    isSonarLike: boolean;
    sonarProbability: number;
    reasons: string[];
    metrics: Record<string, number>;
  } | null;
  qualityStatus?: 'GOOD' | 'FAIR' | 'POOR' | 'UNUSABLE' | null;
  createdAt: string;
}

export type HistoricalReferenceType = 'SHIPWRECK' | 'CONTAINER' | 'MARINE_DEBRIS' | 'FISHING_GEAR' | 'OTHER';

export interface HistoricalReference {
  _id: string;
  sourceId: string;
  name: string;
  type: HistoricalReferenceType;
  eventYear: number;
  eventDate: string;
  latitude: number;
  longitude: number;
  depthMeters: number | null;
  quantity: number | null;
  description: string | null;
  sourceOrganization: string;
  sourceUrl: string;
  coordinateAccuracy: 'EXACT' | 'APPROXIMATE';
  dataStatus: 'HISTORICAL_REFERENCE';
  normalizedLongitudeNote?: string | null;
  tags: string[];
}

export interface GlobeAnomaly {
  id: string;
  anomalyId: string;
  targetName?: string;
  detailedType?: string;
  depthFt?: string | null;
  sonarEvidence?: string | null;
  surveyId: string;
  sonarFrameId: string;
  type: string;
  confidence: number;
  latitude: number;
  longitude: number;
  depth: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  riskLevel: RiskLevel;
  status: string;
  sourceType: string;
  coordinateSource: string;
  modelVersion: string;
  timestamp: string;
}


// ---------------------------------------------------------------- Reports
export type ReportFormat = 'PDF' | 'CSV' | 'JSON' | 'GEOJSON';

export interface Report {
  _id: string;
  surveyId: string;
  surveyCode: string;
  format: ReportFormat;
  fileName: string;
  fileSizeBytes: number;
  detectionCount: number;
  generatedBy: string;
  emailedTo: string[];
  createdAt: string;
}

// ---------------------------------------------------------------- Mail
export interface EmailRecipient {
  _id: string;
  name: string;
  email: string;
  organization: string;
  subscribedEvents: string[];
  isActive: boolean;
  createdAt: string;
}

export interface EmailLog {
  _id: string;
  to: string;
  subject: string;
  triggerEvent: string;
  status: 'SENT' | 'LOGGED_ONLY' | 'FAILED';
  messageId: string;
  errorMessage: string;
  createdAt: string;
}

// ---------------------------------------------------------------- Notifications
export interface AppNotification {
  _id: string;
  type: string;
  title: string;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'INFO';
  isRead: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------- Audit
export interface AuditLogEntry {
  _id: string;
  userEmail: string;
  userRole: string;
  action: string;
  category: string;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, any>;
  outcome: string;
  createdAt: string;
}

// ---------------------------------------------------------------- Users
export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  isEmailVerified: boolean;
  operatorPermissions: AuthUser['operatorPermissions'];
  lastLoginAt: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------- AI Training
export interface Dataset {
  _id: string;
  name: string;
  description: string;
  classes: string[];
  status: 'DRAFT' | 'SPLIT' | 'READY';
  imageCount: number;
  createdAt: string;
  classDistribution?: { _id: string; count: number }[];
}

export interface TrainingJob {
  _id: string;
  datasetId: string;
  hyperparameters: {
    epochs: number;
    learningRate: number;
    batchSize: number;
    valSplit: number;
    testSplit: number;
    useAugmentation: boolean;
    architecture: string;
  };
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  progressPct: number;
  logLines: string[];
  metrics: {
    trainSamples: number;
    valSamples: number;
    testSamples: number;
    epochsRun: number;
    finalTrainLoss: number;
    accuracy: number;
    precisionMacro: number;
    recallMacro: number;
    f1Macro: number;
    perClass: { class: string; precision: number; recall: number; f1: number; support: number }[];
    confusionMatrix: number[][];
    classLabels: string[];
    inferenceLatencyMsP50: number;
    inferenceLatencyMsP95: number;
    mAP50: number | null;
    mAP50_95: number | null;
    metricsNote: string;
  } | null;
  errorMessage: string | null;
  resultingModelVersionId: string | null;
  createdAt: string;
}

export interface ModelVersion {
  _id: string;
  version: string;
  architecture: string;
  datasetId: string;
  trainingJobId: string;
  metricsSnapshot: Record<string, any>;
  classLabels: string[];
  isActive: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------- FRIDAY
export interface FridayCommandResult {
  requiresConfirmation: boolean;
  interactionId?: string;
  success?: boolean;
  spokenResponse: string;
  data?: Record<string, any>;
  intent?: string;
  suggestion?: { text: string; basedOn: string; suggestedIntent: string; suggestedParameters: Record<string, any> } | null;
}

export interface FridayInteraction {
  _id: string;
  transcript: string;
  intent: string;
  parameters: Record<string, any>;
  status: string;
  spokenResponse: string;
  createdAt: string;
}
