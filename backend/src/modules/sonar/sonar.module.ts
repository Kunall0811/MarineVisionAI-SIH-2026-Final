import { Module } from '@nestjs/common';
import { SonarService } from './sonar.service';
import { SonarController } from './sonar.controller';
import { SonarProcessingService } from './sonar-processing.service';
import { SonarQueueProcessor } from './sonar.processor';
import { SurveysModule } from '../surveys/surveys.module';
import { StorageModule } from '../storage/storage.module';
import { AiInferenceModule } from '../ai-inference/ai-inference.module';
import { GeolocationModule } from '../geolocation/geolocation.module';
import { DetectionsModule } from '../detections/detections.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    SurveysModule,
    StorageModule,
    AiInferenceModule,
    GeolocationModule,
    DetectionsModule,
    MailModule,
  ],
  providers: [SonarService, SonarProcessingService, SonarQueueProcessor],
  controllers: [SonarController],
  exports: [SonarService, SonarProcessingService],
})
export class SonarModule {}
