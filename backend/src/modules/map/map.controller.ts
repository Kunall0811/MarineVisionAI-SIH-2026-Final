import { Controller, Get, Param, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SurveysService } from '../surveys/surveys.service';
import { DetectionsService } from '../detections/detections.service';

@ApiTags('map')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('map')
export class MapController {
  constructor(
    private surveysService: SurveysService,
    private detectionsService: DetectionsService,
  ) {}

  private async assertSurveyAccess(user: any, surveyId: string) {
    const survey = await this.surveysService.findById(surveyId);
    if (user.role === 'OPERATOR' && !this.surveysService.isOperatorAssigned(survey as any, user.userId)) {
      throw new ForbiddenException({
        success: false,
        error: { code: 'NOT_ASSIGNED', message: 'You are not assigned to this survey.' },
      });
    }
    return survey;
  }

  @Get('anomalies')
  async anomalies(@CurrentUser() user: any) {
    const filter: Record<string, any> = { location: { $ne: null } };
    const { items } = await this.detectionsService.findAll(filter, 1, 2000);
    return {
      success: true,
      data: {
        type: 'FeatureCollection',
        features: items.map((d) => ({
          type: 'Feature',
          properties: {
            id: d._id,
            anomalyCode: d.anomalyCode,
            class: d.class,
            confidence: d.finalConfidence,
            depth: d.depth,
            length: d.length,
            width: d.width,
            status: d.status,
            riskLevel: d.riskLevel,
            locationStatus: d.locationStatus,
          },
          geometry: { type: 'Point', coordinates: [d.longitude, d.latitude] },
        })),
      },
    };
  }

  @Get('routes/:surveyId')
  async route(@CurrentUser() user: any, @Param('surveyId') surveyId: string) {
    const survey = await this.assertSurveyAccess(user, surveyId);
    return {
      success: true,
      data: {
        type: 'Feature',
        properties: { surveyId: survey._id, code: survey.code, dataType: survey.dataType },
        geometry: survey.route,
      },
    };
  }

  @Get('geojson/:surveyId')
  async surveyGeoJson(@CurrentUser() user: any, @Param('surveyId') surveyId: string) {
    const survey = await this.assertSurveyAccess(user, surveyId);
    const detections = await this.detectionsService.findBySurvey(surveyId, { location: { $ne: null } });

    return {
      success: true,
      data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { kind: 'survey_route', code: survey.code, dataType: survey.dataType },
            geometry: survey.route,
          },
          ...detections.map((d) => ({
            type: 'Feature',
            properties: {
              kind: 'anomaly',
              id: d._id,
              anomalyCode: d.anomalyCode,
              class: d.class,
              confidence: d.finalConfidence,
              riskLevel: d.riskLevel,
              status: d.status,
              locationStatus: d.locationStatus,
              depth: d.depth,
              length: d.length,
              width: d.width,
            },
            geometry: { type: 'Point', coordinates: [d.longitude, d.latitude] },
          })),
        ],
      },
    };
  }
}
