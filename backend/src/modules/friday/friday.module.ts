import { Module } from '@nestjs/common';
import { IntentParserService } from './intent-parser.service';
import { CommandExecutorService } from './command-executor.service';
import { LearningService } from './learning.service';
import { FridayController } from './friday.controller';
import { SurveysModule } from '../surveys/surveys.module';
import { DetectionsModule } from '../detections/detections.module';
import { SonarModule } from '../sonar/sonar.module';
import { ReportsModule } from '../reports/reports.module';
import { MailModule } from '../mail/mail.module';
import { AuditModule } from '../audit/audit.module';
import { ElevenLabsService } from './elevenlabs.service';

@Module({
  imports: [
    SurveysModule,
    DetectionsModule,
    SonarModule,
    ReportsModule,
    MailModule,
    AuditModule,
  ],
  providers: [IntentParserService, CommandExecutorService, LearningService, ElevenLabsService],
  controllers: [FridayController],
})
export class FridayModule {}
