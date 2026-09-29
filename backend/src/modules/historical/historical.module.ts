import { Module } from '@nestjs/common';
import { HistoricalController } from './historical.controller';
import { HistoricalService } from './historical.service';

@Module({
  imports: [],
  controllers: [HistoricalController],
  providers: [HistoricalService],
  exports: [HistoricalService],
})
export class HistoricalModule {}
