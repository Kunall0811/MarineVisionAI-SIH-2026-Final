import { Module } from '@nestjs/common';
import { AiInferenceModule } from '../ai-inference/ai-inference.module';
import { DetectionsModule } from '../detections/detections.module';
import { AiTrainingModule } from '../ai-training/ai-training.module';
import { StorageModule } from '../storage/storage.module';
import { AiStatusController } from './ai-status.controller';
import { ModelController } from './model.controller';
import { NotificationsModule } from '../notifications/notifications.module';

import { SonarModule } from '../sonar/sonar.module';

@Module({
  imports: [AiInferenceModule, DetectionsModule, AiTrainingModule, StorageModule, NotificationsModule, SonarModule],
  controllers: [AiStatusController, ModelController],
})
export class AiStatusModule {}
