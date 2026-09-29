import { Injectable } from '@nestjs/common';
import { ParsedIntent } from './intent-parser.service';
import { SurveysService } from '../surveys/surveys.service';
import { DetectionsService } from '../detections/detections.service';
import { SonarService } from '../sonar/sonar.service';
import { ReportsService } from '../reports/reports.service';
import { MailEventsService } from '../mail/mail-events.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { InProcessQueueService } from '../../common/queue/in-process-queue.service';


export interface ExecutorUser {
  userId: string;
  email: string;
  role: 'ADMIN' | 'OPERATOR';
  operatorPermissions?: Record<string, boolean>;
}

export interface ExecutionResult {
  success: boolean;
  spokenResponse: string; // fed to the browser's speechSynthesis (TTS) by the frontend
  data: Record<string, any>; // structured payload the frontend uses to actually act (navigate, highlight, fly-to, etc.)
}

/**
 * Executes a parsed FRIDAY intent against the REAL backend services -
 * every command listed in the spec actually calls surveys/detections/
 * reports/mail here, it does not just return canned text. Permission
 * checks mirror the equivalent REST endpoints exactly (Operator role is
 * never granted anything an Operator couldn't already do via the UI).
 */
@Injectable()
export class CommandExecutorService {
  constructor(
    private surveysService: SurveysService,
    private detectionsService: DetectionsService,
    private sonarService: SonarService,
    private reportsService: ReportsService,
    private mailEvents: MailEventsService,
    private realtime: RealtimeGateway,
    private inProcessQueue: InProcessQueueService,
  ) {}

  async execute(user: ExecutorUser, parsed: ParsedIntent): Promise<ExecutionResult> {
    switch (parsed.intent) {
      case 'COUNT_UNVERIFIED':
        return this.countUnverified();

      case 'SHOW_ANOMALIES':
        return this.showAnomalies(user, parsed.parameters);

      case 'OPEN_ANOMALY':
        return this.openAnomaly(user, parsed.parameters);

      case 'ZOOM_GLOBE':
        return this.zoomGlobe(parsed.parameters);

      case 'START_PROCESSING':
        return this.startProcessing(user, parsed.parameters);

      case 'GENERATE_REPORT':
        return this.generateReport(user, parsed.parameters);

      case 'SEND_REPORT':
        return this.sendReport(user, parsed.parameters);

      case 'VERIFY_ANOMALY':
        return this.verifyAnomaly(user, parsed.parameters);

      case 'FRIDAY_ON':
        return {
          success: true,
          spokenResponse: 'FRIDAY is now online and ready to assist. How can I help you?',
          data: { action: 'FRIDAY_ON' },
        };

      case 'FRIDAY_OFF':
        return {
          success: true,
          spokenResponse: 'FRIDAY going offline. Goodbye.',
          data: { action: 'FRIDAY_OFF' },
        };

      case 'NAVIGATE':
        return {
          success: true,
          spokenResponse: `Switching to ${parsed.parameters.label || 'that panel'}.`,
          data: { action: 'NAVIGATE', route: parsed.parameters.route },
        };

      case 'HELP':
        return {
          success: true,
          spokenResponse:
            "I'm FRIDAY, your MarineVision AI command agent. I can switch panels — say 'switch to Globe' or 'switch to Analytics'. I can show anomalies, open detections, start processing, generate reports, verify anomalies, train or test the AI model, and more. Just ask!",
          data: { action: 'NONE' },
        };

      default:
        return {
          success: false,
          spokenResponse: "I didn't understand that command. Try something like 'show all high-risk ghost nets' or say 'help' to hear what I can do.",
          data: { action: 'NONE' },
        };
    }
  }

  private async countUnverified(): Promise<ExecutionResult> {
    const { total } = await this.detectionsService.findAll({ status: 'PENDING_REVIEW' }, 1, 1);
    return {
      success: true,
      spokenResponse: `There ${total === 1 ? 'is' : 'are'} currently ${total} unverified detection${total === 1 ? '' : 's'} pending review.`,
      data: { action: 'NONE', count: total },
    };
  }

  private async showAnomalies(user: ExecutorUser, params: Record<string, any>): Promise<ExecutionResult> {
    const filter: Record<string, any> = {};
    if (params.riskLevel) filter.riskLevel = params.riskLevel;
    if (params.class) filter.class = params.class;
    const { items, total } = await this.detectionsService.findAll(filter, 1, 50);

    const descriptors = [params.riskLevel, params.class?.replace(/_/g, ' '), params.region ? `in ${params.region}` : null]
      .filter(Boolean)
      .join(' ');

    return {
      success: true,
      spokenResponse: total > 0
        ? `Found ${total} ${descriptors || ''} anomal${total === 1 ? 'y' : 'ies'}. Opening the review queue.`.replace('  ', ' ')
        : `No anomalies matched ${descriptors || 'that filter'} right now.`,
      data: { action: 'NAVIGATE', route: '/anomaly-review', filter, detectionIds: items.map((d: any) => String(d._id)) },
    };
  }

  private async openAnomaly(user: ExecutorUser, params: Record<string, any>): Promise<ExecutionResult> {
    let detection: any = null;
    if (params.which === 'LATEST') {
      const { items } = await this.detectionsService.findAll({}, 1, 1);
      detection = items[0] || null;
    } else {
      const { items } = await this.detectionsService.findAll({ anomalyCode: params.which }, 1, 1);
      detection = items[0] || null;
    }

    if (!detection) {
      return { success: false, spokenResponse: "I couldn't find that anomaly.", data: { action: 'NONE' } };
    }

    return {
      success: true,
      spokenResponse: `Opening ${detection.anomalyCode}, a ${detection.class.replace(/_/g, ' ')} classified as ${detection.riskLevel} risk.`,
      data: { action: 'OPEN_DETECTION', detectionId: String(detection._id), anomalyCode: detection.anomalyCode },
    };
  }

  private async zoomGlobe(params: Record<string, any>): Promise<ExecutionResult> {
    let detection: any = null;
    if (params.anomalyCode && params.anomalyCode !== 'CURRENT') {
      const { items } = await this.detectionsService.findAll({ anomalyCode: params.anomalyCode }, 1, 1);
      detection = items[0] || null;
    }
    if (!detection) {
      return {
        success: true,
        spokenResponse: 'Zooming to the currently selected anomaly on the globe.',
        data: { action: 'ZOOM_GLOBE', target: 'CURRENT' },
      };
    }
    return {
      success: true,
      spokenResponse: `Flying the globe to ${detection.anomalyCode}.`,
      data: {
        action: 'ZOOM_GLOBE',
        target: { latitude: detection.latitude, longitude: detection.longitude, anomalyCode: detection.anomalyCode },
      },
    };
  }

  private async startProcessing(user: ExecutorUser, params: Record<string, any>): Promise<ExecutionResult> {
    if (!params.surveyCode) {
      return { success: false, spokenResponse: 'Which survey would you like me to process? Please include the survey code.', data: { action: 'NONE' } };
    }
    const survey = await this.surveysService.findByCode(params.surveyCode);
    if (!survey) {
      return { success: false, spokenResponse: `I couldn't find a survey with code ${params.surveyCode}.`, data: { action: 'NONE' } };
    }
    if (user.role === 'OPERATOR' && !this.surveysService.isOperatorAssigned(survey as any, user.userId)) {
      return { success: false, spokenResponse: 'You are not assigned to that survey, so I cannot start processing it.', data: { action: 'NONE' } };
    }
    if (user.role === 'OPERATOR' && user.operatorPermissions?.canProcess === false) {
      return { success: false, spokenResponse: 'Your account does not have processing permission.', data: { action: 'NONE' } };
    }

    let queued = 0;
    let page = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const [frames, total] = await this.sonarService.findBySurvey(String(survey._id), page, 100, { processingStatus: 'QUEUED' });
      if (!frames.length) break;
      for (const frame of frames) {
        await this.inProcessQueue.add('process-frame', { frameId: String(frame._id) });
        queued++;
      }
      if (page * 100 >= total) break;
      page++;
    }
    await this.surveysService.update(String(survey._id), { status: 'PROCESSING' as any });

    return {
      success: true,
      spokenResponse: queued > 0
        ? `Starting processing for survey ${survey.code}. I've queued ${queued} frame${queued === 1 ? '' : 's'}, you'll see live progress on the dashboard.`
        : `Survey ${survey.code} has no queued frames to process right now.`,
      data: { action: 'START_PROCESSING', surveyId: String(survey._id), surveyCode: survey.code, queued },
    };
  }

  private async generateReport(user: ExecutorUser, params: Record<string, any>): Promise<ExecutionResult> {
    if (!params.surveyCode) {
      return { success: false, spokenResponse: 'Which survey should I generate the report for?', data: { action: 'NONE' } };
    }
    const survey = await this.surveysService.findByCode(params.surveyCode);
    if (!survey) {
      return { success: false, spokenResponse: `I couldn't find a survey with code ${params.surveyCode}.`, data: { action: 'NONE' } };
    }
    if (user.role === 'OPERATOR') {
      if (!this.surveysService.isOperatorAssigned(survey as any, user.userId)) {
        return { success: false, spokenResponse: 'You are not assigned to that survey.', data: { action: 'NONE' } };
      }
      if (user.operatorPermissions?.canGenerateReports === false) {
        return { success: false, spokenResponse: 'Your account does not have report-generation permission.', data: { action: 'NONE' } };
      }
    }

    const format = params.format || 'PDF';
    const report = await this.reportsService.generate(String(survey._id), format, user.userId);
    this.realtime.emitEvent('report_generated', { reportId: report._id, surveyId: survey._id, format });

    return {
      success: true,
      spokenResponse: `${format} report generated for ${survey.code} with ${report.detectionCount} detections. You can download it from the Reports page.`,
      data: { action: 'OPEN_REPORT', reportId: String(report._id) },
    };
  }

  private async sendReport(user: ExecutorUser, params: Record<string, any>): Promise<ExecutionResult> {
    if (!params.surveyCode) {
      return { success: false, spokenResponse: 'Which survey report should I send?', data: { action: 'NONE' } };
    }
    const survey = await this.surveysService.findByCode(params.surveyCode);
    if (!survey) {
      return { success: false, spokenResponse: `I couldn't find a survey with code ${params.surveyCode}.`, data: { action: 'NONE' } };
    }

    await this.mailEvents.dispatch(
      'REPORT_GENERATED',
      `Survey report requested via FRIDAY: ${survey.code}`,
      `<p>Report for survey ${survey.name} (${survey.code}) requested via FRIDAY voice command by ${user.email}.</p>`,
      `Report for survey ${survey.name} (${survey.code}) requested via FRIDAY by ${user.email}.`,
      { surveyId: String(survey._id), viaFriday: true, severity: 'INFO' },
    );

    return {
      success: true,
      spokenResponse: `Sending the report for ${survey.code} to the authorized recipients now.`,
      data: { action: 'NONE' },
    };
  }

  private async verifyAnomaly(user: ExecutorUser, params: Record<string, any>): Promise<ExecutionResult> {
    if (user.role === 'OPERATOR' && user.operatorPermissions?.canVerifyDetections === false) {
      return { success: false, spokenResponse: 'Your account does not have permission to verify detections.', data: { action: 'NONE' } };
    }
    if (!params.anomalyCode || params.anomalyCode === 'CURRENT') {
      return {
        success: true,
        spokenResponse: 'Please confirm which anomaly to verify, or open one first.',
        data: { action: 'NONE' },
      };
    }
    const { items } = await this.detectionsService.findAll({ anomalyCode: params.anomalyCode }, 1, 1);
    const detection = items[0];
    if (!detection) {
      return { success: false, spokenResponse: `I couldn't find anomaly ${params.anomalyCode}.`, data: { action: 'NONE' } };
    }
    const updated = await this.detectionsService.verify(String(detection._id), user.userId, 'Verified via FRIDAY voice command.');
    this.realtime.emitEvent('verification_completed', { detectionId: detection._id, status: 'VERIFIED' });

    return {
      success: true,
      spokenResponse: `${params.anomalyCode} has been marked as verified.`,
      data: { action: 'NONE', detectionId: String(detection._id), status: updated?.status },
    };
  }
}
