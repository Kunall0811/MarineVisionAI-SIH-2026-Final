import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SurveysService } from '../surveys/surveys.service';
import { DetectionsService } from '../detections/detections.service';
import { WaterBodiesService } from '../water-bodies/water-bodies.service';
import { HistoricalService } from '../historical/historical.service';

@ApiTags('globe')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('globe')
export class GlobeController {
  constructor(
    private surveysService: SurveysService,
    private detectionsService: DetectionsService,
    private waterBodiesService: WaterBodiesService,
    private historicalService: HistoricalService,
  ) {}

  @Get('surveys')
  async surveys(@CurrentUser() user: any) {
    const filter: Record<string, any> = {};
    if (user.role === 'OPERATOR') filter.assignedOperators = user.userId;
    const { items } = await this.surveysService.findAll(filter, 1, 500);
    return {
      success: true,
      data: items.map((s) => ({
        id: s._id,
        code: s.code,
        name: s.name,
        status: s.status,
        dataType: s.dataType,
        waterBodyName: s.waterBodyName,
        region: s.region,
        totalFrames: s.totalFrames,
        processedFrames: s.processedFrames,
        route: s.route,
      })),
    };
  }

  @Get('anomalies')
  async anomalies(
    @Query('surveyId') surveyId?: string,
    @Query('riskLevel') riskLevel?: string,
    @Query('dataType') dataType?: string,
    @Query('class') klass?: string,
  ) {
    const filter: Record<string, any> = { location: { $ne: null } };
    if (surveyId) filter.surveyId = surveyId;
    if (riskLevel) filter.riskLevel = riskLevel;
    if (dataType) filter.dataType = dataType;
    if (klass) filter.class = klass;

    const { items } = await this.detectionsService.findAll(filter, 1, 2000);
    return {
      success: true,
      data: items.map((d) => ({
        id: d._id,
        anomalyCode: d.anomalyCode,
        targetName: d.targetName || d.anomalyCode,
        name: d.targetName || d.anomalyCode,
        surveyId: d.surveyId,
        class: d.class,
        type: d.class,
        detailedType: d.detailedType || d.class,
        confidence: d.finalConfidence,
        latitude: d.latitude,
        longitude: d.longitude,
        depth: d.depth,
        depthFt: d.depthFt || (d.depth != null ? `${Math.round(d.depth * 3.28084)} ft` : null),
        sonarEvidence: d.sonarEvidence || d.historicalSource,
        riskLevel: d.riskLevel,
        status: d.status,
        locationStatus: d.locationStatus,
        dataType: d.dataType,
        historicalSource: d.historicalSource,
      })),
    };
  }

  @Get('water-bodies')
  async waterBodies(@Query('type') type?: string) {
    const filter: Record<string, any> = {};
    if (type) filter.type = type;
    const items = await this.waterBodiesService.findAll(filter);
    return {
      success: true,
      data: {
        type: 'FeatureCollection',
        features: items.map((w) => ({
          type: 'Feature',
          properties: { id: w._id, name: w.name, type: w.type, region: w.region, source: w.source },
          geometry: w.geometry,
        })),
      },
    };
  }

  @Get('layers')
  async layers() {
    // Layer catalogue driven by what actually exists in the DB right now,
    // not a hardcoded static list.
    const [waterBodyCount, detectionStats] = await Promise.all([
      this.waterBodiesService.count(),
      this.detectionsService.globalStatistics(),
    ]);
    return {
      success: true,
      data: {
        waterBodies: waterBodyCount,
        classes: detectionStats.byClass,
        riskLevels: detectionStats.byRisk,
      },
    };
  }

  @Get('historical-reference')
  async historicalReference(
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
        source: 'MarineVision MemoryStore historical_references',
        dataStatus: 'HISTORICAL_REFERENCE',
        note: 'Documented historical records; not AI detections and not current sonar observations.',
      },
    };
  }

  @Get('historical')
  async historical(@Query('surveyId') surveyId?: string) {
    const filter: Record<string, any> = { dataType: 'HISTORICAL', location: { $ne: null } };
    if (surveyId) filter.surveyId = surveyId;
    const { items } = await this.detectionsService.findAll(filter, 1, 2000);
    return {
      success: true,
      data: items.map((d) => ({
        id: d._id,
        anomalyCode: d.anomalyCode,
        class: d.class,
        latitude: d.latitude,
        longitude: d.longitude,
        historicalSource: d.historicalSource,
        dataType: d.dataType,
      })),
    };
  }
}
