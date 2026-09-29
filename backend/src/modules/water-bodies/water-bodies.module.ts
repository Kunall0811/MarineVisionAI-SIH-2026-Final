import { Module } from '@nestjs/common';
import { WaterBodiesService } from './water-bodies.service';
import { WaterBodiesController } from './water-bodies.controller';

@Module({
  imports: [],
  providers: [WaterBodiesService],
  controllers: [WaterBodiesController],
  exports: [WaterBodiesService],
})
export class WaterBodiesModule {}
