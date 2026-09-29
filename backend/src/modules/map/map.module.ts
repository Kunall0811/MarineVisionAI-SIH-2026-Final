import { Module } from '@nestjs/common';
import { MapController } from './map.controller';
import { SurveysModule } from '../surveys/surveys.module';
import { DetectionsModule } from '../detections/detections.module';

@Module({
  imports: [SurveysModule, DetectionsModule],
  controllers: [MapController],
})
export class MapModule {}
