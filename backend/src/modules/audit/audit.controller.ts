import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditService } from './audit.service';

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('audit-logs')
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get()
  @Roles('ADMIN')
  async list(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('category') category?: string,
    @Query('userId') userId?: string,
    @Query('outcome') outcome?: string,
  ) {
    const filter: Record<string, any> = {};
    if (category) filter.category = category;
    if (userId) filter.userId = userId;
    if (outcome) filter.outcome = outcome;
    const { items, total } = await this.auditService.findAll(filter, parseInt(page, 10), parseInt(limit, 10));
    return { success: true, data: items, meta: { total, page: parseInt(page, 10), limit: parseInt(limit, 10) } };
  }

  @Get('categories')
  @Roles('ADMIN')
  async categories() {
    const data = await this.auditService.categories();
    return { success: true, data };
  }
}
