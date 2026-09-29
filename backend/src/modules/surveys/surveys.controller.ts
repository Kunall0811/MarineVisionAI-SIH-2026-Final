import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SurveysService } from './surveys.service';
import { CreateSurveyDto } from './dto/create-survey.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@ApiTags('surveys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('surveys')
export class SurveysController {
  constructor(
    private surveysService: SurveysService,
    private realtime: RealtimeGateway,
  ) {}

  @Post()
  async create(@CurrentUser() user: any, @Body() dto: CreateSurveyDto) {
    if (dto.dataType === 'HISTORICAL' && !dto.historicalSource) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'HISTORICAL_SOURCE_REQUIRED',
          message: 'Historical surveys must include a historicalSource (dataset/provenance).',
        },
      });
    }

    const existing = await this.surveysService.findByCode(dto.code);
    if (existing) {
      throw new BadRequestException({
        success: false,
        error: { code: 'SURVEY_CODE_EXISTS', message: 'A survey with this code already exists.' },
      });
    }

    let route = dto.route;
    if (!route && dto.startLat != null && dto.startLon != null) {
      const coords = [[Number(dto.startLon), Number(dto.startLat)]];
      if (dto.endLat != null && dto.endLon != null) {
        coords.push([Number(dto.endLon), Number(dto.endLat)]);
      }
      route = { type: 'LineString', coordinates: coords };
    }

    const survey = await this.surveysService.create({
      ...dto,
      route: route || { type: 'LineString', coordinates: [] },
      createdBy: user.userId,
      assignedOperators: (dto.assignedOperators as any) || [],
      surveyDate: dto.surveyDate ? new Date(dto.surveyDate) : null,
    } as any);

    this.realtime.emitEvent('survey_started', {
      surveyId: survey._id,
      code: survey.code,
      name: survey.name,
      dataType: survey.dataType,
      route: survey.route,
    });

    return { success: true, data: survey };
  }

  @Get()
  async list(
    @CurrentUser() user: any,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
    @Query('dataType') dataType?: string,
  ) {
    const filter: Record<string, any> = {};
    if (status) filter.status = status;
    if (dataType) filter.dataType = dataType;
    if (user.role === 'OPERATOR') {
      filter.assignedOperators = user.userId;
    }
    const { items, total } = await this.surveysService.findAll(filter, parseInt(page, 10), parseInt(limit, 10));
    return { success: true, data: items, meta: { total, page: parseInt(page, 10), limit: parseInt(limit, 10) } };
  }

  @Get(':id')
  async get(@CurrentUser() user: any, @Param('id') id: string) {
    const survey = await this.surveysService.findById(id);
    if (user.role === 'OPERATOR' && !this.surveysService.isOperatorAssigned(survey as any, user.userId)) {
      throw new ForbiddenException({
        success: false,
        error: { code: 'NOT_ASSIGNED', message: 'You are not assigned to this survey.' },
      });
    }
    return { success: true, data: survey };
  }

  @Patch(':id')
  async update(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    if (user.role === 'OPERATOR') {
      throw new ForbiddenException({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only Admins can edit survey configuration.' },
      });
    }
    const survey = await this.surveysService.update(id, body);
    return { success: true, data: survey };
  }

  @Delete(':id')
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    if (user.role === 'OPERATOR') {
      throw new ForbiddenException({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only Admins can delete surveys.' },
      });
    }
    await this.surveysService.delete(id);
    return { success: true, data: { id } };
  }
}
