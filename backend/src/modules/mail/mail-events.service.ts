import { Injectable, Logger } from '@nestjs/common';
import { InProcessQueueService } from '../../common/queue/in-process-queue.service';
import { ALERT_EVENT_TYPES } from './schemas/email-recipient.schema';
import { MailService } from './mail.service';
import { EmailLogService } from './email-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

export type AlertEvent = (typeof ALERT_EVENT_TYPES)[number];

/**
 * Public entry point other modules use to trigger authority-email alerts.
 * Dispatches asynchronously through the InProcessQueueService.
 */
@Injectable()
export class MailEventsService {
  private readonly logger = new Logger('MailEventsService');

  constructor(
    private inProcessQueue: InProcessQueueService,
    private mailService: MailService,
    private emailLogService: EmailLogService,
    private notificationsService: NotificationsService,
    private realtime: RealtimeGateway,
  ) {}

  async dispatch(
    event: AlertEvent,
    subject: string,
    html: string,
    text: string,
    metadata: Record<string, any> = {},
  ) {
    try {
      await this.inProcessQueue.add('send-event-email', { event, subject, html, text, metadata });
    } catch (queueErr: any) {
      this.logger.log(`Dispatching email directly in background: ${queueErr.message}`);
      let toList: string[] = [];
      if (metadata?.recipientEmails && Array.isArray(metadata.recipientEmails)) {
        toList = metadata.recipientEmails;
      } else if (metadata?.recipientEmail) {
        toList = [metadata.recipientEmail];
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
              filename: metadata.fileName || 'MarineVision_Report.pdf',
              path: metadata.reportPath,
            });
          }
        } catch {}
      }

      setImmediate(async () => {
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
        } catch (err: any) {
          this.logger.error(`Direct email dispatch failed: ${err.message}`);
        }
      });
    }
  }
}
