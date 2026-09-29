import { Controller, Get, Post, Body, Param, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DetectionsService } from './detections.service';
import { SurveysService } from '../surveys/surveys.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { MailEventsService } from '../mail/mail-events.service';
import { AuditService } from '../audit/audit.service';

@ApiTags('detections')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class DetectionsController {
  constructor(
    private detectionsService: DetectionsService,
    private surveysService: SurveysService,
    private realtime: RealtimeGateway,
    private mailEvents: MailEventsService,
    private auditService: AuditService,
  ) {}

  @Get('detections')
  async list(
    @CurrentUser() user: any,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('class') klass?: string,
    @Query('status') status?: string,
    @Query('riskLevel') riskLevel?: string,
    @Query('surveyId') surveyId?: string,
  ) {
    const filter: Record<string, any> = {};
    if (klass) filter.class = klass;
    if (status) filter.status = status;
    if (riskLevel) filter.riskLevel = riskLevel;
    if (surveyId) filter.surveyId = surveyId;

    if (user.role === 'OPERATOR' && surveyId) {
      const survey = await this.surveysService.findById(surveyId);
      if (!this.surveysService.isOperatorAssigned(survey as any, user.userId)) {
        throw new ForbiddenException({
          success: false,
          error: { code: 'NOT_ASSIGNED', message: 'You are not assigned to this survey.' },
        });
      }
    }

    const { items, total } = await this.detectionsService.findAll(filter, parseInt(page, 10), parseInt(limit, 10));
    return { success: true, data: items, meta: { total, page: parseInt(page, 10), limit: parseInt(limit, 10) } };
  }

  @Get('detections/:id')
  async get(@Param('id') id: string) {
    const detection = await this.detectionsService.findById(id);
    return { success: true, data: detection };
  }

  @Get('detections/survey/:surveyId')
  async bySurvey(@Param('surveyId') surveyId: string) {
    const detections = await this.detectionsService.findBySurvey(surveyId);
    return { success: true, data: detections };
  }

  @Post('detections/:id/verify')
  async verify(@CurrentUser() user: any, @Param('id') id: string, @Body() body: { comment?: string }) {
    if (user.role === 'OPERATOR' && user.operatorPermissions?.canVerifyDetections === false) {
      throw new ForbiddenException({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'You do not have permission to verify detections.' },
      });
    }
    const detection = await this.detectionsService.verify(id, user.userId, body.comment || '');
    this.realtime.emitEvent('verification_completed', { detectionId: id, status: 'VERIFIED' });

    await this.auditService.record({
      userId: user.userId,
      userEmail: user.email,
      userRole: user.role,
      action: 'DETECTION_VERIFIED',
      category: 'DETECTIONS',
      targetType: 'Detection',
      targetId: id,
      metadata: { comment: body.comment || '' },
    });

    this.mailEvents
      .dispatch(
        'ANOMALY_VERIFIED',
        `Anomaly verified: ${detection?.anomalyCode || id}`,
        `<div style="font-family:sans-serif"><p>Detection <b>${detection?.anomalyCode}</b> (${detection?.class}) was verified by ${user.email}.</p><p>Comment: ${body.comment || '(none)'}</p></div>`,
        `Detection ${detection?.anomalyCode} (${detection?.class}) verified by ${user.email}.`,
        { detectionId: id, severity: 'INFO' },
      )
      .catch(() => undefined);

    return { success: true, data: detection };
  }

  @Post('detections/:id/reject')
  async reject(@CurrentUser() user: any, @Param('id') id: string, @Body() body: { comment?: string }) {
    const detection = await this.detectionsService.reject(id, user.userId, body.comment || '');
    this.realtime.emitEvent('verification_completed', { detectionId: id, status: 'REJECTED' });
    return { success: true, data: detection };
  }

  @Post('detections/:id/review')
  async review(@CurrentUser() user: any, @Param('id') id: string, @Body() body: { comment?: string }) {
    const detection = await this.detectionsService.needsReview(id, user.userId, body.comment || '');
    this.realtime.emitEvent('verification_completed', { detectionId: id, status: 'NEEDS_REVIEW' });
    return { success: true, data: detection };
  }
}
