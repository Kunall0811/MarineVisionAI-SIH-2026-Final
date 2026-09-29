import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { StoreModule } from './store/store.module';
import { InProcessQueueModule } from './common/queue/in-process-queue.module';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { MailModule } from './modules/mail/mail.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { SurveysModule } from './modules/surveys/surveys.module';
import { SonarModule } from './modules/sonar/sonar.module';
import { DetectionsModule } from './modules/detections/detections.module';
import { AiInferenceModule } from './modules/ai-inference/ai-inference.module';
import { GeolocationModule } from './modules/geolocation/geolocation.module';
import { StorageModule } from './modules/storage/storage.module';
import { WaterBodiesModule } from './modules/water-bodies/water-bodies.module';
import { GlobeModule } from './modules/globe/globe.module';
import { MapModule } from './modules/map/map.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AuditModule } from './modules/audit/audit.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AiTrainingModule } from './modules/ai-training/ai-training.module';
import { FridayModule } from './modules/friday/friday.module';
import { HistoricalModule } from './modules/historical/historical.module';
import { AiStatusModule } from './modules/ai-status/ai-status.module';

import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),

    StoreModule, // @Global - in-memory data store (no external database required)
    InProcessQueueModule, // @Global - in-process async background queue (no Redis/BullMQ required)

    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),

    RealtimeModule, // @Global - registers the WebSocket gateway once

    AuthModule,
    UsersModule,
    MailModule,
    SurveysModule,
    StorageModule,
    AiInferenceModule,
    GeolocationModule,
    SonarModule,
    DetectionsModule,
    WaterBodiesModule,
    GlobeModule,
    MapModule,
    DashboardModule,
    AuditModule,
    NotificationsModule,
    ReportsModule,
    AiTrainingModule,
    FridayModule,
    HistoricalModule,
    AiStatusModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
