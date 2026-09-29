import { Module } from '@nestjs/common';
import { DetectionsService } from './detections.service';
import { DetectionsController } from './detections.controller';
import { AnomaliesController } from './anomalies.controller';
import { SurveysModule } from '../surveys/surveys.module';
import { MailModule } from '../mail/mail.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    SurveysModule,
    MailModule,
    AuditModule,
    NotificationsModule,
  ],
  providers: [DetectionsService],
  controllers: [DetectionsController, AnomaliesController],
  exports: [DetectionsService],
})
export class DetectionsModule {}
