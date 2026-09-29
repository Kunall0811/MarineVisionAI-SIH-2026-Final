import { Injectable } from '@nestjs/common';
import { MemoryStore } from '../../store/memoryStore';
import { HistoricalReference } from '../../store/types';
import { historicalData } from '../../seed/historical-data';

@Injectable()
export class HistoricalService {
  constructor(private readonly store: MemoryStore) {}

  private get model() {
    return this.store.historicalReferences;
  }

  async list(filters: { type?: string; fromYear?: number; toYear?: number; search?: string } = {}) {
    const q: Record<string, any> = {};
    if (filters.type) q.type = filters.type;
    if (filters.fromYear != null) q.eventYear = { ...q.eventYear, $gte: filters.fromYear };
    if (filters.toYear != null) q.eventYear = { ...q.eventYear, $lte: filters.toYear };
    if (filters.search) {
      q.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
        { tags: { $regex: filters.search, $options: 'i' } },
      ];
    }
    return this.model.find(q).sort({ eventYear: -1, name: 1 }).lean().exec();
  }

  async upsertMany(records: Array<Partial<HistoricalReference>>) {
    const operations = records.map((record) => ({
      updateOne: {
        filter: { sourceId: record.sourceId },
        update: { $set: record },
        upsert: true,
      },
    }));
    if (!operations.length) return { upserted: 0, modified: 0 };
    const result = await this.model.bulkWrite(operations as any);
    return { upserted: result.upsertedCount, modified: result.modifiedCount };
  }

  async seedDefaults() {
    const result = await this.upsertMany(historicalData as any);
    return result;
  }

  async count() {
    return this.model.countDocuments().exec();
  }
}
