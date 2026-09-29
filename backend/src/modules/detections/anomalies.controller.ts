import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DetectionsService } from './detections.service';
import { SurveysService } from '../surveys/surveys.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { DetectionDocument } from './schemas/detection.schema';

// Helper to map a Detection document to the requested Anomaly shape
function mapToAnomaly(d: any) {
  const statusMap: Record<string, string> = {
    PENDING_REVIEW: 'needs_verification',
    NEEDS_REVIEW: 'needs_verification',
    VERIFIED: 'verified',
    REJECTED: 'rejected',
  };

  return {
    id: d._id.toString(),
    _id: d._id.toString(),
    anomalyId: d.anomalyCode,
    anomalyCode: d.anomalyCode,
    targetName: d.targetName || d.anomalyCode,
    name: d.targetName || d.anomalyCode,
    type: d.class,
    class: d.class,
    detailedType: d.detailedType || d.class,
    confidence: d.finalConfidence ?? d.confidence,
    finalConfidence: d.finalConfidence ?? d.confidence,
    shadowScore: d.shadowScore ?? 0,
    latitude: d.latitude,
    longitude: d.longitude,
    depth: d.depth,
    depthFt: d.depthFt || (d.depth != null ? `${Math.round(d.depth * 3.28084)} ft` : null),
    locationStatus: d.locationStatus || 'REAL',
    sonarEvidence: d.sonarEvidence || d.historicalSource || null,
    length: d.length,
    width: d.width,
    height: d.height,
    status: statusMap[d.status] || 'detected',
    riskLevel: d.riskLevel,
    sourceType: d.dataType?.toLowerCase(),
    coordinateSource: d.coordinateSource,
    modelVersion: d.modelVersion,
    sonarFrameId: d.sonarFrameId ? d.sonarFrameId.toString() : null,
    surveyId: d.surveyId ? d.surveyId.toString() : null,
    bbox: d.bbox || null,
    imageUrl: d.imageUrl || (d.sonarFrameId ? `/api/sonar/${d.sonarFrameId}/image` : null),
    timestamp: d.createdAt,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

@ApiTags('anomalies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('anomalies')
export class AnomaliesController {
  constructor(
    private detectionsService: DetectionsService,
    private surveysService: SurveysService,
    private realtime: RealtimeGateway,
    private notificationsService: NotificationsService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: any,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('riskLevel') riskLevel?: string,
    @Query('surveyId') surveyId?: string,
    @Query('sonarFrameId') sonarFrameId?: string,
    @Query('sourceType') sourceType?: string,
  ) {
    const filter: Record<string, any> = {};
    if (sonarFrameId) {
      filter.sonarFrameId = sonarFrameId;
    }
    if (type) filter.class = type;
    if (status) {
      const revMap: Record<string, string[]> = {
        needs_verification: ['PENDING_REVIEW', 'NEEDS_REVIEW'],
        verified: ['VERIFIED'],
        rejected: ['REJECTED'],
        detected: ['PENDING_REVIEW'],
      };
      filter.status = { $in: revMap[status] || [status] };
    }
    if (riskLevel) filter.riskLevel = riskLevel;
    if (surveyId) filter.surveyId = surveyId;
    if (sourceType) filter.dataType = sourceType.toUpperCase();

    const { items, total } = await this.detectionsService.findAll(filter, parseInt(page, 10), parseInt(limit, 10));
    return { success: true, data: items.map(mapToAnomaly), meta: { total, page: parseInt(page, 10), limit: parseInt(limit, 10) } };
  }

  @Get('live')
  async listLive(@Query('page') page = '1', @Query('limit') limit = '50') {
    const { items, total } = await this.detectionsService.findAll({ dataType: 'LIVE' }, parseInt(page, 10), parseInt(limit, 10));
    return { success: true, data: items.map(mapToAnomaly), meta: { total, page: parseInt(page, 10), limit: parseInt(limit, 10) } };
  }

  @Get('historical')
  async listHistorical(@Query('page') page = '1', @Query('limit') limit = '50') {
    const { items, total } = await this.detectionsService.findAll({ dataType: 'HISTORICAL' }, parseInt(page, 10), parseInt(limit, 10));
    return { success: true, data: items.map(mapToAnomaly), meta: { total, page: parseInt(page, 10), limit: parseInt(limit, 10) } };
  }

  @Get('geojson')
  async getGeoJson(@Query('sourceType') sourceType?: string) {
    const filter: Record<string, any> = {};
    if (sourceType) filter.dataType = sourceType.toUpperCase();

    // Limit geojson to max 5000 points to avoid browser crash
    const { items } = await this.detectionsService.findAll(filter, 1, 5000);
    
    const features = items.map(d => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [d.longitude, d.latitude],
      },
      properties: mapToAnomaly(d),
    }));

    return {
      type: 'FeatureCollection',
      features,
    };
  }

  @Get('nearby')
  async getNearby(
    @Query('lat') lat: string,
    @Query('lon') lon: string,
    @Query('distance') distance = '5000'
  ) {
    if (!lat || !lon) throw new BadRequestException('lat and lon are required');
    const items = await this.detectionsService.findNearby(parseFloat(lon), parseFloat(lat), parseInt(distance, 10));
    return { success: true, data: items.map(mapToAnomaly) };
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const detection = await this.detectionsService.findById(id);
    return { success: true, data: mapToAnomaly(detection) };
  }

  @Post()
  async create(@CurrentUser() user: any, @Body() body: any) {
    
    if (body.latitude !== undefined && (body.latitude < -90 || body.latitude > 90)) {
      throw new BadRequestException('Latitude must be between -90 and 90');
    }
    if (body.longitude !== undefined && (body.longitude < -180 || body.longitude > 180)) {
      throw new BadRequestException('Longitude must be between -180 and 180');
    }

    const doc: any = {
      surveyId: body.surveyId || '000000000000000000000000', // require a valid ObjectId for mongoose if not provided
      sonarFrameId: body.sonarFrameId || '000000000000000000000000',
      anomalyCode: body.anomalyId || `ANM-SIM-${Date.now()}`,
      class: body.type,
      confidence: body.confidence,
      finalConfidence: body.confidence,
      latitude: body.latitude,
      longitude: body.longitude,
      depth: body.depth,
      length: body.length,
      width: body.width,
      height: body.height,
      riskLevel: body.riskLevel || 'LOW',
      dataType: body.sourceType ? body.sourceType.toUpperCase() : 'LIVE',
      coordinateSource: body.coordinateSource || 'SIMULATED_DEMO',
      modelVersion: body.modelVersion || 'v1.0.0-demo',
      bbox: { x1: 0, y1: 0, x2: 10, y2: 10 },
      locationStatus: 'ESTIMATED',
    };

    if (body.latitude && body.longitude) {
      doc.location = {
        type: 'Point',
        coordinates: [body.longitude, body.latitude]
      };
    }

    const created = await this.detectionsService.create(doc);
    const anomaly = mapToAnomaly(created);

    this.realtime.emitEvent('anomaly_created', anomaly);

    // Instant notification across all operator and admin panels
    this.notificationsService.createForEveryone({
      type: 'ANOMALY_CREATED',
      title: `New Sonar Anomaly: ${anomaly.targetName || anomaly.anomalyId}`,
      message: `Target ${anomaly.anomalyId} (${anomaly.detailedType || anomaly.type}) at ${anomaly.latitude?.toFixed(4)}°, ${anomaly.longitude?.toFixed(4)}° plotted on 3D Globe.`,
      severity: anomaly.riskLevel === 'CRITICAL' ? 'CRITICAL' : anomaly.riskLevel === 'HIGH' ? 'HIGH' : 'INFO',
      metadata: { anomalyId: anomaly.id, anomalyCode: anomaly.anomalyId, latitude: anomaly.latitude, longitude: anomaly.longitude },
    }).catch(() => undefined);

    return { success: true, data: anomaly };
  }

  @Patch(':id')
  async update(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    // Verifying, rejecting, correcting class/risk, or otherwise mutating a
    // detection modifies the authoritative map. Per spec, operators must
    // never be able to do this directly - they can only submit new sonar
    // frames for AI analysis, which land in the admin review queue.
    if (user.role === 'OPERATOR') {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Operators cannot verify, reject, or edit detections directly. Submit for admin review instead.',
        },
      });
    }

    // Map and coordinate updates
    const update: any = {};
    if (body.type) update.class = body.type;
    if (body.riskLevel) update.riskLevel = body.riskLevel;
    if (body.status) {
       const statusMap: Record<string, string> = {
         needs_verification: 'PENDING_REVIEW',
         verified: 'VERIFIED',
         rejected: 'REJECTED'
       };
       update.status = statusMap[body.status] || 'PENDING_REVIEW';
    }
    if (body.latitude !== undefined && body.latitude !== null) {
      update.latitude = Number(body.latitude);
    }
    if (body.longitude !== undefined && body.longitude !== null) {
      update.longitude = Number(body.longitude);
    }
    if (update.latitude !== undefined && update.longitude !== undefined) {
      update.location = {
        type: 'Point',
        coordinates: [update.longitude, update.latitude],
      };
      update.locationStatus = 'REAL';
      update.coordinateSource = 'SURVEY_METADATA';
    }
    if (body.depth !== undefined && body.depth !== null) update.depth = Number(body.depth);
    if (body.targetName) update.targetName = body.targetName;
    if (body.detailedType) update.detailedType = body.detailedType;
    if (body.bbox) update.bbox = body.bbox;

    const updated = await this.detectionsService.update(id, update);
    const anomaly = mapToAnomaly(updated);
    
    // Broadcast live to all connected clients (globes, GIS maps, tactical dashboards)
    this.realtime.emitEvent('anomaly_updated', anomaly);
    if (update.latitude !== undefined || update.longitude !== undefined) {
      this.realtime.emitEvent('coordinate_updated', {
        id: anomaly.id,
        anomalyId: anomaly.anomalyId,
        latitude: anomaly.latitude,
        longitude: anomaly.longitude,
        anomaly,
      });
    }
    if (anomaly.status === 'verified') {
      this.realtime.emitEvent('anomaly_verified', anomaly);
    } else if (anomaly.status === 'rejected') {
      this.realtime.emitEvent('anomaly_rejected', anomaly);
    }

    // Instant notification across all operator and admin panels
    const actionLabel = anomaly.status === 'verified' ? 'Verified' : anomaly.status === 'rejected' ? 'Rejected' : 'Updated';
    let notifMessage = `Admin updated anomaly ${anomaly.anomalyId} (${anomaly.detailedType || anomaly.type}) to ${anomaly.status.toUpperCase()}.`;
    if (update.latitude !== undefined && update.longitude !== undefined) {
      notifMessage = `Admin updated coordinates of ${anomaly.anomalyId} to (${anomaly.latitude?.toFixed(5)}°, ${anomaly.longitude?.toFixed(5)}°). Marker moved live on all operator globes.`;
    }

    this.notificationsService.createForEveryone({
      type: 'ANOMALY_UPDATED',
      title: `Globe Anomaly ${actionLabel}: ${anomaly.targetName || anomaly.anomalyId}`,
      message: notifMessage,
      severity: anomaly.riskLevel === 'CRITICAL' ? 'CRITICAL' : anomaly.riskLevel === 'HIGH' ? 'HIGH' : 'INFO',
      metadata: {
        anomalyId: anomaly.id,
        anomalyCode: anomaly.anomalyId,
        status: anomaly.status,
        latitude: anomaly.latitude,
        longitude: anomaly.longitude,
      },
    }).catch(() => undefined);

    return { success: true, data: anomaly };
  }
}
