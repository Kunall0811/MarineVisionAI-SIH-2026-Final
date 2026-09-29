import * as fs from 'fs';

export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  appPublicUrl: process.env.APP_PUBLIC_URL || 'http://localhost:5173',

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret:
      process.env.JWT_REFRESH_SECRET || 'dev-only-insecure-refresh-secret-change-me',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  storage: {
    driver: process.env.STORAGE_DRIVER || 'local',
    localPath:
      process.env.STORAGE_LOCAL_PATH ||
      (fs.existsSync('./data') ? './data' : './sonar-storage'),
    endpoint: process.env.OBJECT_STORAGE_ENDPOINT || '',
    accessKey: process.env.OBJECT_STORAGE_ACCESS_KEY || '',
    secretKey: process.env.OBJECT_STORAGE_SECRET_KEY || '',
    bucket: process.env.OBJECT_STORAGE_BUCKET || 'marinevision-sonar',
  },

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.SMTP_FROM || 'MarineVision AI <no-reply@marinevision.ai>',
    configured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER),
  },

  ai: {
    onnxModelPath:
      process.env.ONNX_MODEL_PATH || './ai-models/marine-yolo26x.onnx',
    modelVersion: process.env.AI_MODEL_VERSION || 'yolo26x-sidescan-v1',
    confidenceThreshold: parseFloat(process.env.AI_CONFIDENCE_THRESHOLD || '0.35'),
  },

  cesiumIonToken: process.env.CESIUM_ION_TOKEN || '',
  elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY || '',
    voiceId: process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM',
    ttsModel: process.env.ELEVENLABS_TTS_MODEL || 'eleven_multilingual_v2',
    sttModel: process.env.ELEVENLABS_STT_MODEL || 'scribe_v2',
  },
});
