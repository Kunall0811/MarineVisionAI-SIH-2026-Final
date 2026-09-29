import { Injectable } from '@nestjs/common';
import { MemoryStore } from '../../store/memoryStore';
import { EmailLog } from '../../store/types';

@Injectable()
export class EmailLogService {
  constructor(private readonly store: MemoryStore) {}

  private get model() {
    return this.store.emailLogs;
  }

  record(data: Partial<EmailLog>) {
    return this.model.create(data);
  }

  async findAll(page = 1, limit = 30, filter: Record<string, any> = {}) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }
}
