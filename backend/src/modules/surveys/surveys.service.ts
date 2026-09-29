import { Injectable, NotFoundException } from '@nestjs/common';
import { MemoryStore } from '../../store/memoryStore';
import { Survey } from '../../store/types';

@Injectable()
export class SurveysService {
  constructor(private readonly store: MemoryStore) {}

  private get surveyModel() {
    return this.store.surveys;
  }

  create(data: Partial<Survey>) {
    return this.surveyModel.create({
      totalFrames: 0,
      processedFrames: 0,
      failedFrames: 0,
      assignedOperators: [],
      dataType: 'LIVE',
      status: 'DRAFT',
      route: { type: 'LineString', coordinates: [] },
      ...data,
    });
  }

  async findAll(filter: Record<string, any> = {}, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.surveyModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.surveyModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  async findById(id: string) {
    let survey: any = null;
    survey = await this.surveyModel.findById(id).exec();
    if (!survey) {
      survey = await this.surveyModel.findOne({ code: id }).exec();
    }
    if (!survey) {
      throw new NotFoundException({
        success: false,
        error: { code: 'SURVEY_NOT_FOUND', message: 'Survey not found.' },
      });
    }
    return survey;
  }

  async findByCode(code: string) {
    return this.surveyModel.findOne({ code }).exec();
  }

  async update(id: string, update: Partial<Survey>) {
    const existing = await this.surveyModel.findById(id).exec();
    if (existing) {
      return this.surveyModel.findByIdAndUpdate(id, update, { new: true }).exec();
    }
    return this.surveyModel.findOneAndUpdate({ code: id }, update, { new: true }).exec();
  }

  async incrementFrameCounts(id: string, fields: { totalFrames?: number; processedFrames?: number; failedFrames?: number }) {
    const inc: Record<string, number> = {};
    if (fields.totalFrames) inc.totalFrames = fields.totalFrames;
    if (fields.processedFrames) inc.processedFrames = fields.processedFrames;
    if (fields.failedFrames) inc.failedFrames = fields.failedFrames;

    const existing = await this.surveyModel.findById(id).exec();
    if (existing) {
      return this.surveyModel.findByIdAndUpdate(id, { $inc: inc }, { new: true }).exec();
    }
    return this.surveyModel.findOneAndUpdate({ code: id }, { $inc: inc }, { new: true }).exec();
  }

  async appendRoutePoint(id: string, longitude: number, latitude: number) {
    return this.surveyModel
      .findByIdAndUpdate(id, { $push: { 'route.coordinates': [longitude, latitude] } }, { new: true })
      .exec();
  }

  delete(id: string) {
    return this.surveyModel.findByIdAndDelete(id).exec();
  }

  isOperatorAssigned(survey: any, operatorId: string) {
    if (!survey || !survey.assignedOperators) return false;
    return survey.assignedOperators.some((id: any) => String(id) === String(operatorId));
  }
}
