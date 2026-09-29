import { Injectable, Logger } from '@nestjs/common';
import { MemoryStore } from '../../store/memoryStore';
import { AuditLog } from '../../store/types';

export interface RecordAuditInput {
  userId: string;
  userEmail: string;
  userRole: 'ADMIN' | 'OPERATOR';
  action: string;
  category: string;
  targetType?: string;
  targetId?: string | null;
  metadata?: Record<string, any>;
  ipAddress?: string;
  outcome?: 'SUCCESS' | 'FAILED' | 'DENIED';
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger('AuditService');

  constructor(private readonly store: MemoryStore) {}

  private get auditModel() {
    return this.store.auditLogs;
  }

  async record(input: RecordAuditInput) {
    try {
      return await this.auditModel.create({
        userId: input.userId,
        userEmail: input.userEmail,
        userRole: input.userRole,
        action: input.action,
        category: input.category,
        targetType: input.targetType || '',
        targetId: input.targetId || null,
        metadata: input.metadata || {},
        ipAddress: input.ipAddress || '',
        outcome: input.outcome || 'SUCCESS',
      });
    } catch (err: any) {
      // Auditing must never break the primary action it is logging.
      this.logger.error(`Failed to write audit log for action=${input.action}: ${err.message}`);
      return null;
    }
  }

  async findAll(filter: Record<string, any> = {}, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.auditModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.auditModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  async categories() {
    return this.auditModel.distinct('category').exec();
  }
}
