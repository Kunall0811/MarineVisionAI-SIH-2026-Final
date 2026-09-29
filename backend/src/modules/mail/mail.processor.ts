import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MailService } from './mail.service';
import { EmailRecipientsService } from './email-recipients.service';
import { EmailLogService } from './email-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { InProcessQueueService } from '../../common/queue/in-process-queue.service';

export interface MailJobData {
  event: string;
  subject: string;
  html: string;
  text: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class MailQueueProcessor implements OnModuleInit {
  private readonly logger = new Logger('MailQueueProcessor');

  constructor(
    private mailService: MailService,
    private recipientsService: EmailRecipientsService,
    private emailLogService: EmailLogService,
    private notificationsService: NotificationsService,
    private realtime: RealtimeGateway,
    private inProcessQueue: InProcessQueueService,
  ) {}

  onModuleInit() {
    this.inProcessQueue.registerHandler('send-event-email', async (data: MailJobData) => {
      return this.process({ data });
    });
  }

  async process(job: { data: MailJobData }): Promise<any> {
    const { event, subject, html, text, metadata } = job.data;

    const recipients = await this.recipientsService.findByEvent(event);
    let toList = recipients.map((r) => r.email);

    if (metadata?.recipientEmails && Array.isArray(metadata.recipientEmails)) {
      toList = Array.from(new Set([...toList, ...metadata.recipientEmails.filter(Boolean)]));
    } else if (metadata?.recipientEmail) {
      toList = Array.from(new Set([...toList, metadata.recipientEmail]));
    }

    if (toList.length === 0) {
      toList = ['asonawane260686@gmail.com'];
    }

    const attachments: { filename: string; path?: string }[] = [];
    if (metadata?.reportPath) {
      try {
        const fs = await import('fs');
        if (fs.existsSync(metadata.reportPath)) {
          attachments.push({
            filename: metadata.fileName || 'MarineVision_Sonar_Report.pdf',
            path: metadata.reportPath,
          });
        }
      } catch (attErr: any) {
        this.logger.warn(`Could not attach report file: ${attErr.message}`);
      }
    }

    try {
      const result = await this.mailService.send({ to: toList, subject, html, text, attachments });
      await this.emailLogService.record({
        to: toList.join(', '),
        subject,
        triggerEvent: event,
        status: result.status,
        messageId: result.messageId || '',
        metadata,
      });
      this.realtime.emitEvent('email_sent', { event, to: toList, status: result.status, subject });
      await this.notificationsService.createForAdmins({
        type: event,
        title: subject,
        message: text?.slice(0, 280) || subject,
        severity: metadata?.severity || 'INFO',
        metadata,
      });
      return { sent: result.status === 'SENT', status: result.status };
    } catch (err: any) {
      this.logger.error(`Failed to send ${event} email: ${err.message}`);
      await this.emailLogService.record({
        to: toList.join(', '),
        subject,
        triggerEvent: event,
        status: 'FAILED',
        metadata,
      });
      return { sent: false, status: 'FAILED', error: err.message };
    }
  }
}
