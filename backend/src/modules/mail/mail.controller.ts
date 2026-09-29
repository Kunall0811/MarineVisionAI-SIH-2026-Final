import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { EmailRecipientsService } from './email-recipients.service';
import { EmailLogService } from './email-log.service';
import { AuditService } from '../audit/audit.service';

@ApiTags('mail')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('mail')
export class MailController {
  constructor(
    private recipientsService: EmailRecipientsService,
    private emailLogService: EmailLogService,
    private auditService: AuditService,
  ) {}

  @Get('recipients')
  @Roles('ADMIN')
  async listRecipients() {
    const data = await this.recipientsService.findAll();
    return { success: true, data };
  }

  @Post('recipients')
  @Roles('ADMIN')
  async createRecipient(@CurrentUser() user: any, @Body() body: any) {
    const recipient = await this.recipientsService.create({
      name: body.name,
      email: String(body.email || '').toLowerCase().trim(),
      organization: body.organization || '',
      subscribedEvents: body.subscribedEvents || undefined,
      addedBy: user.userId,
    });
    await this.auditService.record({
      userId: user.userId,
      userEmail: user.email,
      userRole: user.role,
      action: 'EMAIL_RECIPIENT_ADDED',
      category: 'MAIL',
      targetType: 'EmailRecipient',
      targetId: String(recipient._id),
      metadata: { email: recipient.email },
    });
    return { success: true, data: recipient };
  }

  @Patch('recipients/:id')
  @Roles('ADMIN')
  async updateRecipient(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    const allowed = ['name', 'email', 'organization', 'subscribedEvents', 'isActive'];
    const update: Record<string, any> = {};
    for (const key of allowed) if (body[key] !== undefined) update[key] = body[key];
    const recipient = await this.recipientsService.update(id, update);
    await this.auditService.record({
      userId: user.userId,
      userEmail: user.email,
      userRole: user.role,
      action: 'EMAIL_RECIPIENT_UPDATED',
      category: 'MAIL',
      targetType: 'EmailRecipient',
      targetId: id,
      metadata: update,
    });
    return { success: true, data: recipient };
  }

  @Delete('recipients/:id')
  @Roles('ADMIN')
  async removeRecipient(@CurrentUser() user: any, @Param('id') id: string) {
    await this.recipientsService.delete(id);
    await this.auditService.record({
      userId: user.userId,
      userEmail: user.email,
      userRole: user.role,
      action: 'EMAIL_RECIPIENT_REMOVED',
      category: 'MAIL',
      targetType: 'EmailRecipient',
      targetId: id,
    });
    return { success: true, data: { id } };
  }

  @Get('logs')
  @Roles('ADMIN')
  async logs(@Query('page') page = '1', @Query('limit') limit = '30', @Query('triggerEvent') triggerEvent?: string) {
    const filter: Record<string, any> = {};
    if (triggerEvent) filter.triggerEvent = triggerEvent;
    const { items, total } = await this.emailLogService.findAll(parseInt(page, 10), parseInt(limit, 10), filter);
    return { success: true, data: items, meta: { total, page: parseInt(page, 10), limit: parseInt(limit, 10) } };
  }
}
