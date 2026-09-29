import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { MemoryStore } from '../../store/memoryStore';
import { ModelVersion } from '../../store/types';

function hasRealMetrics(metrics: Record<string, any> | undefined | null): boolean {
  if (!metrics) return false;
  const candidates = [
    metrics.precisionMacro,
    metrics.recallMacro,
    metrics.f1Macro,
    metrics.accuracy,
    metrics.mAP50,
    metrics.map50,
  ];
  return candidates.some((v) => typeof v === 'number' && !Number.isNaN(v));
}

@Injectable()
export class ModelVersionsService {
  constructor(private readonly store: MemoryStore) {}

  private get model() {
    return this.store.modelVersions;
  }

  create(data: Partial<ModelVersion>) {
    const qualityState = hasRealMetrics(data.metricsSnapshot) ? 'VALIDATED' : 'EXPERIMENTAL';
    return this.model.create({ ...data, qualityState, isActive: false });
  }

  findAll() {
    return this.model.find().sort({ createdAt: -1 }).exec();
  }

  async findById(id: string) {
    const version = await this.model.findById(id).exec();
    if (!version) {
      throw new NotFoundException({ success: false, error: { code: 'MODEL_VERSION_NOT_FOUND', message: 'Model version not found.' } });
    }
    return version;
  }

  async promoteToCandidate(id: string) {
    const version = await this.findById(id);
    if (version.qualityState !== 'VALIDATED') {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'MODEL_NOT_VALIDATED',
          message: `Model is ${version.qualityState}, not VALIDATED. It needs real test-split evaluation metrics before it can become a production candidate.`,
        },
      });
    }
    return this.model.findByIdAndUpdate(id, { qualityState: 'PRODUCTION_CANDIDATE' }, { new: true }).exec();
  }

  async activate(id: string) {
    const version = await this.findById(id);
    if (version.qualityState !== 'PRODUCTION_CANDIDATE' && version.qualityState !== 'VALIDATED') {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'MODEL_NOT_READY',
          message: `Model is ${version.qualityState}. Only VALIDATED or PRODUCTION_CANDIDATE models (real test-split metrics on file) can be activated. Experimental/smoke-test models cannot serve production inference.`,
        },
      });
    }
    await this.model.updateMany({ isActive: true }, { isActive: false, qualityState: 'VALIDATED' }).exec();
    return this.model.findByIdAndUpdate(id, { isActive: true, qualityState: 'ACTIVE' }, { new: true }).exec();
  }

  active() {
    return this.model.findOne({ isActive: true }).exec();
  }
}
