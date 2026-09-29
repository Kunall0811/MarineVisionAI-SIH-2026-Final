import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { SurveysModule } from '../surveys/surveys.module';
import { DetectionsModule } from '../detections/detections.module';
import { SonarModule } from '../sonar/sonar.module';
import { StorageModule } from '../storage/storage.module';
import { MailModule } from '../mail/mail.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    SurveysModule,
    DetectionsModule,
    SonarModule,
    StorageModule,
    MailModule,
    AuditModule,
  ],
  providers: [ReportsService],
  controllers: [ReportsController],
  exports: [ReportsService],
})
export class ReportsModule {}
