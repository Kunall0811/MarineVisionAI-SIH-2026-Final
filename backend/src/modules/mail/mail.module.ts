import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailEventsService } from './mail-events.service';
import { MailQueueProcessor } from './mail.processor';
import { MailController } from './mail.controller';
import { EmailRecipientsService } from './email-recipients.service';
import { EmailLogService } from './email-log.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    NotificationsModule,
    AuditModule,
  ],
  providers: [MailService, MailEventsService, MailQueueProcessor, EmailRecipientsService, EmailLogService],
  controllers: [MailController],
  exports: [MailService, MailEventsService, EmailRecipientsService, EmailLogService],
})
export class MailModule {}
