import { Module } from '@nestjs/common';
import { GlobeController } from './globe.controller';
import { SurveysModule } from '../surveys/surveys.module';
import { DetectionsModule } from '../detections/detections.module';
import { WaterBodiesModule } from '../water-bodies/water-bodies.module';
import { HistoricalModule } from '../historical/historical.module';

@Module({
  imports: [SurveysModule, DetectionsModule, WaterBodiesModule, HistoricalModule],
  controllers: [GlobeController],
})
export class GlobeModule {}
