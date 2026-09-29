import { Injectable } from '@nestjs/common';
import { MemoryStore } from '../../store/memoryStore';
import { Notification } from '../../store/types';
import { UsersService } from '../users/users.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly store: MemoryStore,
    private usersService: UsersService,
    private realtime: RealtimeGateway,
  ) {}

  private get notificationModel() {
    return this.store.notifications;
  }

  async createFor(recipientId: string | null, data: Partial<Notification>) {
    const notification = await this.notificationModel.create({ isRead: false, ...data, recipientId });
    this.realtime.emitEvent('notification_created', {
      id: notification._id,
      recipientId,
      type: notification.type,
      title: notification.title,
      severity: notification.severity,
    });
    return notification;
  }

  /** Broadcasts one notification per active ADMIN account. Used for system-wide alerts. */
  async createForAdmins(data: Partial<Notification>) {
    const [admins] = await this.usersService.findAllPaginated(1, 1000, { role: 'ADMIN', isActive: true });
    return Promise.all(admins.map((a) => this.createFor(String(a._id), data)));
  }

  /** Broadcasts one notification to ALL active users (both ADMIN and OPERATOR accounts). Used for globe updates and system alerts. */
  async createForEveryone(data: Partial<Notification>) {
    const [users] = await this.usersService.findAllPaginated(1, 1000, { isActive: true });
    return Promise.all(users.map((u) => this.createFor(String(u._id), data)));
  }

  async findForUser(userId: string, page = 1, limit = 30, unreadOnly = false) {
    const filter: Record<string, any> = { recipientId: userId };
    if (unreadOnly) filter.isRead = false;
    const skip = (page - 1) * limit;
    const [items, total, unreadCount] = await Promise.all([
      this.notificationModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.notificationModel.countDocuments(filter).exec(),
      this.notificationModel.countDocuments({ recipientId: userId, isRead: false }).exec(),
    ]);
    return { items, total, unreadCount };
  }

  markRead(id: string, userId: string) {
    return this.notificationModel.findOneAndUpdate({ _id: id, recipientId: userId }, { isRead: true }, { new: true }).exec();
  }

  markAllRead(userId: string) {
    return this.notificationModel.updateMany({ recipientId: userId, isRead: false }, { isRead: true }).exec();
  }
}
