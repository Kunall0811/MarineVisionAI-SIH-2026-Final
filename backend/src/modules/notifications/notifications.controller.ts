import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  async list(
    @CurrentUser('userId') userId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '30',
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    const { items, total, unreadCount } = await this.notificationsService.findForUser(
      userId,
      parseInt(page, 10),
      parseInt(limit, 10),
      unreadOnly === 'true',
    );
    return { success: true, data: items, meta: { total, unreadCount, page: parseInt(page, 10), limit: parseInt(limit, 10) } };
  }

  @Post(':id/read')
  async markRead(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    const data = await this.notificationsService.markRead(id, userId);
    return { success: true, data };
  }

  @Post('read-all')
  async markAllRead(@CurrentUser('userId') userId: string) {
    await this.notificationsService.markAllRead(userId);
    return { success: true, data: { done: true } };
  }
}
