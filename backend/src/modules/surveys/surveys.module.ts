import { Module } from '@nestjs/common';
import { SurveysService } from './surveys.service';
import { SurveysController } from './surveys.controller';

@Module({
  imports: [],
  providers: [SurveysService],
  controllers: [SurveysController],
  exports: [SurveysService],
})
export class SurveysModule {}
