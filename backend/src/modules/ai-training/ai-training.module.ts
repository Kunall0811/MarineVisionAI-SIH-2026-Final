import { Module } from '@nestjs/common';
import { DatasetsService } from './datasets.service';
import { AiTrainingService } from './ai-training.service';
import { ModelVersionsService } from './model-versions.service';
import { TrainerService } from './trainer.service';
import { AiTrainingProcessor } from './training.processor';
import { AiTrainingController } from './ai-training.controller';
import { StorageModule } from '../storage/storage.module';
import { AuditModule } from '../audit/audit.module';
import { DetectionsModule } from '../detections/detections.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SurveysModule } from '../surveys/surveys.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    StorageModule,
    AuditModule,
    DetectionsModule,
    NotificationsModule,
    SurveysModule,
    MailModule,
  ],
  providers: [DatasetsService, AiTrainingService, ModelVersionsService, TrainerService, AiTrainingProcessor],
  controllers: [AiTrainingController],
  exports: [DatasetsService, AiTrainingService, ModelVersionsService],
})
export class AiTrainingModule {}
