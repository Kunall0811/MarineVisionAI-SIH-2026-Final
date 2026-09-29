import { Injectable, NotFoundException } from '@nestjs/common';
import { MemoryStore } from '../../store/memoryStore';
import { WaterBody } from '../../store/types';

@Injectable()
export class WaterBodiesService {
  constructor(private readonly store: MemoryStore) {}

  private get model() {
    return this.store.waterBodies;
  }

  findAll(filter: Record<string, any> = {}) {
    return this.model.find(filter).exec();
  }

  async findById(id: string) {
    const doc = await this.model.findById(id).exec();
    if (!doc) {
      throw new NotFoundException({
        success: false,
        error: { code: 'WATER_BODY_NOT_FOUND', message: 'Water body not found.' },
      });
    }
    return doc;
  }

  findContainingPoint(longitude: number, latitude: number) {
    return this.model
      .findOne({
        geometry: {
          $geoIntersects: { $geometry: { type: 'Point', coordinates: [longitude, latitude] } },
        },
      })
      .exec();
  }

  upsertByName(name: string, data: Partial<WaterBody>) {
    return this.model.findOneAndUpdate({ name }, data, { upsert: true, new: true }).exec();
  }

  count() {
    return this.model.countDocuments().exec();
  }
}
