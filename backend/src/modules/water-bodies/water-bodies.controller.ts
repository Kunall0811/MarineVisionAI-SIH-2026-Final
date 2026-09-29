import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WaterBodiesService } from './water-bodies.service';

@ApiTags('water-bodies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('water-bodies')
export class WaterBodiesController {
  constructor(private service: WaterBodiesService) {}

  @Get()
  async list(@Query('type') type?: string) {
    const filter: Record<string, any> = {};
    if (type) filter.type = type;
    const items = await this.service.findAll(filter);
    return { success: true, data: items };
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const item = await this.service.findById(id);
    return { success: true, data: item };
  }
}
