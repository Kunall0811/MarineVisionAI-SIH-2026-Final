import { api } from './client';

export const AuthApi = {
  register: (data: { fullName: string; email: string; password: string }) =>
    api.post('/auth/register', data).then((r) => r.data.data),
  login: (data: { email: string; password: string }) => api.post('/auth/login', data).then((r) => r.data.data),
  me: () => api.get('/auth/me').then((r) => r.data.data),
  verifyEmail: (data: { email: string; token: string }) =>
    api.post('/auth/verify-email', data).then((r) => r.data.data),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }).then((r) => r.data.data),
  resetPassword: (data: { email: string; token: string; newPassword: string }) =>
    api.post('/auth/reset-password', data).then((r) => r.data.data),
  logout: () => api.post('/auth/logout').then((r) => r.data.data),
};

export const SurveysApi = {
  list: (params?: Record<string, any>) => api.get('/surveys', { params }).then((r) => r.data),
  get: (id: string) => api.get(`/surveys/${id}`).then((r) => r.data.data),
  create: (data: any) => api.post('/surveys', data).then((r) => r.data.data),
  update: (id: string, data: any) => api.patch(`/surveys/${id}`, data).then((r) => r.data.data),
  remove: (id: string) => api.delete(`/surveys/${id}`).then((r) => r.data.data),
};

export const SonarApi = {
  uploadSingle: (surveyId: string, file: File, onProgress?: (pct: number) => void) => {
    const form = new FormData();
    form.append('surveyId', surveyId);
    form.append('file', file);
    return api
      .post('/sonar/upload', form, {
        onUploadProgress: (e) => onProgress?.(Math.round((e.loaded / (e.total || 1)) * 100)),
      })
      .then((r) => r.data.data);
  },
  uploadBatch: async (
    surveyId: string,
    files: File[],
    onProgress?: (pct: number, details?: { current: number; total: number }) => void,
  ) => {
    const CHUNK_SIZE = 50;
    const total = files.length;
    let uploadedCount = 0;
    const allResults: any[] = [];

    for (let i = 0; i < files.length; i += CHUNK_SIZE) {
      const chunk = files.slice(i, i + CHUNK_SIZE);
      const form = new FormData();
      form.append('surveyId', surveyId);
      chunk.forEach((f) => form.append('files', f));

      const res = await api.post('/sonar/batch-upload', form);
      if (res.data?.data) {
        allResults.push(...res.data.data);
      }
      uploadedCount += chunk.length;
      if (onProgress) {
        const pct = Math.min(100, Math.round((uploadedCount / total) * 100));
        onProgress(pct, { current: uploadedCount, total });
      }
    }
    return allResults;
  },
  uploadNavigationCsv: (surveyId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/sonar/navigation/${surveyId}`, form).then((r) => r.data.data);
  },
  listBySurvey: (surveyId: string, params?: Record<string, any>) =>
    api.get(`/sonar/survey/${surveyId}`, { params }).then((r) => r.data),
  get: (id: string) => api.get(`/sonar/${id}`).then((r) => r.data.data),
  process: (id: string) => api.post(`/sonar/${id}/process`).then((r) => r.data.data),
  processAll: (surveyId: string) => api.post(`/sonar/survey/${surveyId}/process-all`).then((r) => r.data.data),
};

export const DetectionsApi = {
  list: (params?: Record<string, any>) => api.get('/detections', { params }).then((r) => r.data),
  get: (id: string) => api.get(`/detections/${id}`).then((r) => r.data.data),
  bySurvey: (surveyId: string) => api.get(`/detections/survey/${surveyId}`).then((r) => r.data.data),
  verify: (id: string, comment?: string) => api.post(`/detections/${id}/verify`, { comment }).then((r) => r.data.data),
  reject: (id: string, comment?: string) => api.post(`/detections/${id}/reject`, { comment }).then((r) => r.data.data),
  review: (id: string, comment?: string) => api.post(`/detections/${id}/review`, { comment }).then((r) => r.data.data),
};

export const AnomaliesApi = {
  list: (params?: Record<string, any>) => api.get('/anomalies', { params }).then((r) => r.data),
  live: (params?: Record<string, any>) => api.get('/anomalies/live', { params }).then((r) => r.data),
  historical: (params?: Record<string, any>) => api.get('/anomalies/historical', { params }).then((r) => r.data),
  get: (id: string) => api.get(`/anomalies/${id}`).then((r) => r.data.data),
  create: (data: any) => api.post('/anomalies', data).then((r) => r.data.data),
  update: (id: string, data: any) => api.patch(`/anomalies/${id}`, data).then((r) => r.data.data),
};

export const GlobeApi = {
  surveys: () => api.get('/globe/surveys').then((r) => r.data.data),
  anomalies: (params?: Record<string, any>) => api.get('/globe/anomalies', { params }).then((r) => r.data.data),
  waterBodies: (params?: Record<string, any>) => api.get('/globe/water-bodies', { params }).then((r) => r.data.data),
  layers: () => api.get('/globe/layers').then((r) => r.data.data),
  historical: (params?: Record<string, any>) => api.get('/globe/historical', { params }).then((r) => r.data.data),
  historicalReference: (params?: Record<string, any>) => api.get('/globe/historical-reference', { params }).then((r) => r.data),
};

export const MapApi = {
  anomalies: () => api.get('/map/anomalies').then((r) => r.data.data),
  route: (surveyId: string) => api.get(`/map/routes/${surveyId}`).then((r) => r.data.data),
  surveyGeoJson: (surveyId: string) => api.get(`/map/geojson/${surveyId}`).then((r) => r.data.data),
};

export const DashboardApi = {
  summary: () => api.get('/dashboard/summary').then((r) => r.data.data),
  systemHealth: () => api.get('/dashboard/system-health').then((r) => r.data.data),
};

export const StorageUrl = {
  sonarImage: (frameId: string) => `/api/sonar/${frameId}/image`, // served by backend static route in a full deployment
};

export const ReportsApi = {
  generate: (surveyId: string, format: string) => api.post(`/reports/surveys/${surveyId}/generate`, { format }).then((r) => r.data.data),
  list: (params?: Record<string, any>) => api.get('/reports', { params }).then((r) => r.data),
  downloadUrl: (id: string) => `/api/reports/${id}/download`,
  email: (id: string, recipientEmails?: string[]) => api.post(`/reports/${id}/email`, { recipientEmails }).then((r) => r.data.data),
};

export const MailApi = {
  recipients: () => api.get('/mail/recipients').then((r) => r.data.data),
  addRecipient: (data: any) => api.post('/mail/recipients', data).then((r) => r.data.data),
  updateRecipient: (id: string, data: any) => api.patch(`/mail/recipients/${id}`, data).then((r) => r.data.data),
  removeRecipient: (id: string) => api.delete(`/mail/recipients/${id}`).then((r) => r.data.data),
  logs: (params?: Record<string, any>) => api.get('/mail/logs', { params }).then((r) => r.data),
};

export const NotificationsApi = {
  list: (params?: Record<string, any>) => api.get('/notifications', { params }).then((r) => r.data),
  markRead: (id: string) => api.post(`/notifications/${id}/read`).then((r) => r.data.data),
  markAllRead: () => api.post('/notifications/read-all').then((r) => r.data.data),
};

export const AuditApi = {
  list: (params?: Record<string, any>) => api.get('/audit-logs', { params }).then((r) => r.data),
  categories: () => api.get('/audit-logs/categories').then((r) => r.data.data),
};

export const UsersApi = {
  list: (params?: Record<string, any>) => api.get('/users', { params }).then((r) => r.data),
  create: (data: any) => api.post('/users', data).then((r) => r.data.data),
  update: (id: string, data: any) => api.patch(`/users/${id}`, data).then((r) => r.data.data),
  remove: (id: string) => api.delete(`/users/${id}`).then((r) => r.data.data),
};

export const DatasetsApi = {
  list: () => api.get('/datasets').then((r) => r.data),
  get: (id: string) => api.get(`/datasets/${id}`).then((r) => r.data.data),
  create: (data: { name: string; description?: string; classes: string[] }) => api.post('/datasets', data).then((r) => r.data.data),
  remove: (id: string) => api.delete(`/datasets/${id}`).then((r) => r.data.data),
  addImage: (id: string, file: File, label: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('label', label);
    return api.post(`/datasets/${id}/images`, form).then((r) => r.data.data);
  },
  images: (id: string, params?: Record<string, any>) => api.get(`/datasets/${id}/images`, { params }).then((r) => r.data),
  split: (id: string, valSplit?: number, testSplit?: number) => api.post(`/datasets/${id}/split`, { valSplit, testSplit }).then((r) => r.data.data),
  seed1000: (id: string) => api.post(`/datasets/${id}/seed-1000`).then((r) => r.data),
  submitToAdmin: (id: string, notes?: string) => api.post(`/datasets/${id}/submit-to-admin`, { notes }).then((r) => r.data),
  review: (id: string, decision: 'APPROVED' | 'REJECTED', reviewNotes?: string) => api.patch(`/datasets/${id}/review`, { decision, reviewNotes }).then((r) => r.data),
};

export const TrainingApi = {
  start: (data: any) => api.post('/training-jobs', data).then((r) => r.data.data),
  list: () => api.get('/training-jobs').then((r) => r.data),
  get: (id: string) => api.get(`/training-jobs/${id}`).then((r) => r.data.data),
  deployToGlobe: (id: string) => api.post(`/training-jobs/${id}/deploy-to-globe`).then((r) => r.data),
};

export const ModelsApi = {
  list: () => api.get('/model-versions').then((r) => r.data.data),
  active: () => api.get('/model-versions/active').then((r) => r.data.data),
  activate: (id: string) => api.post(`/model-versions/${id}/activate`).then((r) => r.data.data),
  promote: (id: string) => api.post(`/model-versions/${id}/promote`).then((r) => r.data.data),
};

export interface BatchAnalyzeOptions {
  latitude?: number;
  longitude?: number;
  stepLat?: number;
  stepLon?: number;
  plotOnGlobe?: boolean;
  createDataset?: boolean;
  datasetName?: string;
  waterBodyName?: string;
  depth?: number;
}

export const AiStatusApi = {
  status: () => api.get('/ai/status').then((r) => r.data),
  analyzeSonar: (file: File) => {
    const form = new FormData();
    form.append('image', file);
    return api.post('/ai/analyze-sonar', form).then((r) => r.data);
  },
  analyzeBatch: async (
    files: File[],
    options: BatchAnalyzeOptions = {},
    onProgress?: (processed: number, total: number, latestResult?: any) => void,
  ) => {
    const CHUNK_SIZE = 50;
    let totalProcessed = 0;
    let detectionsCount = 0;
    let anomaliesPlottedOnGlobe = 0;
    let datasetInfo: any = null;
    const allResults: any[] = [];

    const baseLat = options.latitude ?? 18.922;
    const baseLon = options.longitude ?? 72.8346;
    const stepLat = options.stepLat ?? 0.0003;
    const stepLon = options.stepLon ?? 0.0004;

    for (let i = 0; i < files.length; i += CHUNK_SIZE) {
      const chunk = files.slice(i, i + CHUNK_SIZE);
      const form = new FormData();
      chunk.forEach((f) => form.append('images', f));

      const chunkLat = baseLat + i * stepLat;
      const chunkLon = baseLon + i * stepLon;

      form.append('latitude', String(chunkLat));
      form.append('longitude', String(chunkLon));
      form.append('stepLat', String(stepLat));
      form.append('stepLon', String(stepLon));
      form.append('plotOnGlobe', String(options.plotOnGlobe !== false));
      form.append('createDataset', String(options.createDataset !== false));
      if (options.datasetName) form.append('datasetName', options.datasetName);
      if (datasetInfo?.id) form.append('datasetId', datasetInfo.id);
      if (options.waterBodyName) form.append('waterBodyName', options.waterBodyName);
      if (options.depth) form.append('depth', String(options.depth));

      const res = await api
        .post('/ai/analyze-batch', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 180000,
        })
        .then((r) => r.data);

      if (res.dataset && !datasetInfo) {
        datasetInfo = res.dataset;
      }
      totalProcessed += res.totalProcessed || chunk.length;
      detectionsCount += res.detectionsCount || 0;
      anomaliesPlottedOnGlobe += res.anomaliesPlottedOnGlobe || 0;
      if (res.results) allResults.push(...res.results);

      if (onProgress) {
        onProgress(totalProcessed, files.length, res);
      }
    }

    return {
      success: true,
      totalProcessed,
      detectionsCount,
      anomaliesPlottedOnGlobe,
      dataset: datasetInfo,
      results: allResults,
    };
  },
};

export const FridayApi = {
  voiceStatus: () => api.get('/friday/voice-status').then((r) => r.data.data),
  speechToText: (audio: Blob) => {
    const form = new FormData();
    form.append('audio', audio, 'friday-audio.webm');
    return api.post('/friday/stt', form).then((r) => r.data.data);
  },
  textToSpeech: async (text: string) => {
    const response = await api.post('/friday/tts', { text }, { responseType: 'blob' });
    return response.data as Blob;
  },
  voiceCommand: (audio: Blob) => {
    const form = new FormData();
    form.append('audio', audio, 'friday-audio.webm');
    return api.post('/friday/voice-command', form).then((r) => r.data.data);
  },
  command: (transcript: string, confirm?: boolean, interactionId?: string) =>
    api.post('/friday/command', { transcript, confirm, interactionId }).then((r) => r.data.data),
  history: (limit = 30) => api.get('/friday/history', { params: { limit } }).then((r) => r.data.data),
  insights: () => api.get('/friday/insights').then((r) => r.data.data),
};
