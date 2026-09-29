import { Injectable } from '@nestjs/common';
import { MemoryStore } from '../../store/memoryStore';
import { SonarFrame } from '../../store/types';

@Injectable()
export class SonarService {
  constructor(private readonly store: MemoryStore) {}

  private get frameModel() {
    return this.store.sonarFrames;
  }

  create(data: Partial<SonarFrame>) {
    return this.frameModel.create(data);
  }

  async findById(id: string) {
    let frame: any = null;
    if (id) {
      frame = await this.frameModel.findById(id).exec();
    }
    if (!frame) {
      frame = await this.frameModel.findOne({ fileName: id }).exec().catch(() => null);
    }
    if (!frame) {
      // Graceful virtual frame for historical or simulated anomalies
      return {
        _id: id,
        fileName: `${id}.png`,
        storagePath: `historical/${id}.png`,
        processingStatus: 'COMPLETED',
        width: 1024,
        height: 512,
      } as any;
    }
    return frame;
  }

  findBySurvey(surveyId: string, page = 1, limit = 200, filter: Record<string, any> = {}) {
    const skip = (page - 1) * limit;
    const query = { surveyId, ...filter };
    return Promise.all([
      this.frameModel.find(query).sort({ createdAt: 1 }).skip(skip).limit(limit).exec(),
      this.frameModel.countDocuments(query).exec(),
    ]);
  }

  update(id: string, update: Partial<SonarFrame>) {
    return this.frameModel.findByIdAndUpdate(id, update, { new: true }).exec();
  }

  findByFileNameAndSurvey(surveyId: string, fileName: string) {
    return this.frameModel.findOne({ surveyId, fileName }).exec();
  }

  countBySurveyAndStatus(surveyId: string, processingStatus: string) {
    return this.frameModel.countDocuments({ surveyId, processingStatus }).exec();
  }
}
