import { Injectable } from '@nestjs/common';
import { MemoryStore } from '../../store/memoryStore';
import { EmailRecipient } from '../../store/types';

@Injectable()
export class EmailRecipientsService {
  constructor(private readonly store: MemoryStore) {}

  private get model() {
    return this.store.emailRecipients;
  }

  create(data: Partial<EmailRecipient>) {
    return this.model.create({ isActive: true, subscribedEvents: [], ...data });
  }

  findAll(activeOnly = false) {
    const filter = activeOnly ? { isActive: true } : {};
    return this.model.find(filter).sort({ createdAt: -1 }).exec();
  }

  findByEvent(event: string) {
    return this.model.find({ isActive: true, subscribedEvents: event }).exec();
  }

  update(id: string, update: Partial<EmailRecipient>) {
    return this.model.findByIdAndUpdate(id, update, { new: true }).exec();
  }

  delete(id: string) {
    return this.model.findByIdAndDelete(id).exec();
  }
}
