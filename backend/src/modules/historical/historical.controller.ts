import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { HistoricalService } from './historical.service';

@ApiTags('historical-reference')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('historical-reference')
export class HistoricalController {
  constructor(private readonly historicalService: HistoricalService) {}

  @Get()
  async list(
    @Query('type') type?: string,
    @Query('fromYear') fromYear?: string,
    @Query('toYear') toYear?: string,
    @Query('search') search?: string,
  ) {
    const data = await this.historicalService.list({
      type,
      fromYear: fromYear ? Number(fromYear) : undefined,
      toYear: toYear ? Number(toYear) : undefined,
      search,
    });
    return {
      success: true,
      data,
      meta: {
        source: 'MarineVision MemoryStore historical_references collection',
        dataStatus: 'HISTORICAL_REFERENCE',
        note: 'These are documented historical reference points, not AI detections or sonar observations.',
      },
    };
  }
}
