import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SurveysService } from '../surveys/surveys.service';
import { DetectionsService } from '../detections/detections.service';
import { AiInferenceService } from '../ai-inference/ai-inference.service';
import { ConfigService } from '@nestjs/config';
import { InProcessQueueService } from '../../common/queue/in-process-queue.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(
    private surveysService: SurveysService,
    private detectionsService: DetectionsService,
    private aiInference: AiInferenceService,
    private config: ConfigService,
    private inProcessQueue: InProcessQueueService,
  ) {}

  @Get('summary')
  async summary() {
    const [{ items: activeSurveys, total: activeSurveyCount }, stats, queueCounts] = await Promise.all([
      this.surveysService.findAll({ status: { $in: ['ACTIVE', 'PROCESSING'] } }, 1, 1),
      this.detectionsService.globalStatistics(),
      this.inProcessQueue.getJobCounts('waiting', 'active', 'completed', 'failed'),
    ]);

    const classCounts = Object.fromEntries(stats.byClass.map((c: any) => [c._id, c.count]));
    const statusCounts = Object.fromEntries(stats.byStatus.map((c: any) => [c._id, c.count]));
    const riskCounts = Object.fromEntries(stats.byRisk.map((c: any) => [c._id, c.count]));

    return {
      success: true,
      data: {
        activeSurveys: activeSurveyCount,
        totalDetections: stats.total,
        highRiskAnomalies: stats.highRisk,
        verifiedDetections: statusCounts['VERIFIED'] || 0,
        pendingReviews: statusCounts['PENDING_REVIEW'] || 0,
        byClass: {
          ghostNets: classCounts['ghost_net'] || 0,
          containers: classCounts['container'] || 0,
          pipes: classCounts['pipe'] || 0,
          shipwrecks: classCounts['shipwreck'] || 0,
          marineDebris: classCounts['marine_debris'] || 0,
          unknownAnomalies: classCounts['unknown_anomaly'] || 0,
        },
        processingQueue: queueCounts,
        source: 'MarineVision In-Memory Store (live) + In-Process Queue',
      },
    };
  }

  @Get('system-health')
  async systemHealth() {
    let queueCounts;
    try {
      queueCounts = await this.inProcessQueue.getJobCounts();
    } catch {
      queueCounts = { waiting: 0, active: 0, completed: 0, failed: 0 };
    }

    return {
      success: true,
      data: {
        aiEngine: {
          status: 'ONLINE',
          modelVersion: this.aiInference.modelVersion,
          mode: this.aiInference.isUsingPlaceholder() ? 'PLACEHOLDER_HEURISTIC' : 'ONNX_MODEL',
        },
        database: { status: 'ONLINE', readyState: 1, mode: 'IN_MEMORY_STORE' },
        storage: { status: 'ONLINE', driver: this.config.get('storage.driver') },
        queue: { status: 'ONLINE', mode: 'IN_PROCESS', counts: queueCounts },
        emailService: { status: this.config.get('smtp.configured') ? 'CONFIGURED' : 'NOT_CONFIGURED' },
        checkedAt: new Date().toISOString(),
      },
    };
  }
}
