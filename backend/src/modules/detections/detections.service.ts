import { Injectable, NotFoundException } from '@nestjs/common';
import { MemoryStore } from '../../store/memoryStore';
import { Detection } from '../../store/types';

@Injectable()
export class DetectionsService {
  constructor(private readonly store: MemoryStore) {}

  private get detectionModel() {
    return this.store.detections;
  }

  create(data: Partial<Detection>) {
    return this.detectionModel.create({
      status: 'PENDING_REVIEW',
      locationStatus: 'REAL',
      dataType: 'LIVE',
      riskLevel: 'LOW',
      confidence: 0.5,
      finalConfidence: 0.5,
      ...data,
    });
  }

  async nextAnomalyCode(surveyId: string): Promise<string> {
    const count = await this.detectionModel.countDocuments({ surveyId }).exec();
    return `ANM-${String(count + 1).padStart(3, '0')}`;
  }

  async findAll(filter: Record<string, any> = {}, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.detectionModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.detectionModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  async findById(id: string) {
    const detection = await this.detectionModel.findById(id).exec();
    if (!detection) {
      throw new NotFoundException({
        success: false,
        error: { code: 'DETECTION_NOT_FOUND', message: 'Detection not found.' },
      });
    }
    return detection;
  }

  findBySurvey(surveyId: string, filter: Record<string, any> = {}) {
    return this.detectionModel.find({ surveyId, ...filter }).sort({ createdAt: -1 }).exec();
  }

  update(id: string, update: Partial<Detection>) {
    return this.detectionModel.findByIdAndUpdate(id, update, { new: true }).exec();
  }

  async verify(id: string, verifiedBy: string, comment: string) {
    return this.detectionModel
      .findByIdAndUpdate(
        id,
        { status: 'VERIFIED', verifiedBy, verifiedAt: new Date(), reviewComment: comment || '' },
        { new: true },
      )
      .exec();
  }

  async reject(id: string, verifiedBy: string, comment: string) {
    return this.detectionModel
      .findByIdAndUpdate(
        id,
        { status: 'REJECTED', verifiedBy, verifiedAt: new Date(), reviewComment: comment || '' },
        { new: true },
      )
      .exec();
  }

  async needsReview(id: string, verifiedBy: string, comment: string) {
    return this.detectionModel
      .findByIdAndUpdate(
        id,
        { status: 'NEEDS_REVIEW', verifiedBy, verifiedAt: new Date(), reviewComment: comment || '' },
        { new: true },
      )
      .exec();
  }

  countBySurveyGroupedByClass(surveyId: string) {
    return this.detectionModel.aggregate([
      { $match: { surveyId } },
      { $group: { _id: '$class', count: { $sum: 1 } } },
    ]);
  }

  /** Global (cross-survey) dashboard aggregation */
  async globalStatistics() {
    const [byClass, byStatus, byRisk, total, highRisk] = await Promise.all([
      this.detectionModel.aggregate([{ $group: { _id: '$class', count: { $sum: 1 } } }]),
      this.detectionModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      this.detectionModel.aggregate([{ $group: { _id: '$riskLevel', count: { $sum: 1 } } }]),
      this.detectionModel.countDocuments().exec(),
      this.detectionModel.countDocuments({ riskLevel: { $in: ['HIGH', 'CRITICAL'] } }).exec(),
    ]);
    return { byClass, byStatus, byRisk, total, highRisk };
  }

  findNearby(longitude: number, latitude: number, maxDistanceMetres = 5000, filter: Record<string, any> = {}) {
    return this.detectionModel
      .find({
        ...filter,
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: [longitude, latitude] },
            $maxDistance: maxDistanceMetres,
          },
        },
      })
      .exec();
  }

  findWithinBounds(swLng: number, swLat: number, neLng: number, neLat: number, filter: Record<string, any> = {}) {
    return this.detectionModel
      .find({
        ...filter,
        location: {
          $geoWithin: {
            $box: [
              [swLng, swLat],
              [neLng, neLat],
            ],
          },
        },
      })
      .exec();
  }
}
