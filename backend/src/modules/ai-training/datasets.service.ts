import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { MemoryStore } from '../../store/memoryStore';
import { Dataset, DatasetImage } from '../../store/types';

@Injectable()
export class DatasetsService {
  constructor(private readonly store: MemoryStore) {}

  private get datasetModel() {
    return this.store.datasets;
  }

  private get imageModel() {
    return this.store.datasetImages;
  }

  create(data: Partial<Dataset>) {
    return this.datasetModel.create({
      status: 'DRAFT',
      imageCount: 0,
      classes: [],
      ...data,
    });
  }

  findAll(page = 1, limit = 30) {
    const skip = (page - 1) * limit;
    return Promise.all([
      this.datasetModel.find().sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.datasetModel.countDocuments().exec(),
    ]);
  }

  async findById(id: string) {
    const dataset = await this.datasetModel.findById(id).exec();
    if (!dataset) {
      throw new NotFoundException({ success: false, error: { code: 'DATASET_NOT_FOUND', message: 'Dataset not found.' } });
    }
    return dataset;
  }

  delete(id: string) {
    return Promise.all([this.datasetModel.findByIdAndDelete(id).exec(), this.imageModel.deleteMany({ datasetId: id }).exec()]);
  }

  update(id: string, data: Partial<Dataset>) {
    return this.datasetModel.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async addImage(datasetId: string, data: Partial<DatasetImage>) {
    const dataset = await this.findById(datasetId);
    if (!dataset.classes.includes(data.label as string)) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'INVALID_LABEL',
          message: `Label "${data.label}" is not one of this dataset's classes: ${dataset.classes.join(', ')}`,
        },
      });
    }
    const image = await this.imageModel.create({ ...data, datasetId });
    await this.datasetModel.findByIdAndUpdate(datasetId, { $inc: { imageCount: 1 } });
    return image;
  }

  async addBatchImages(datasetId: string, items: Array<Partial<DatasetImage>>) {
    const dataset = await this.findById(datasetId);
    if (!items.length) return [];
    const validItems = items.map((d) => ({
      ...d,
      label: dataset.classes.includes(d.label as string) ? d.label : dataset.classes[0],
      datasetId,
    }));
    const created = await this.imageModel.insertMany(validItems);
    await this.datasetModel.findByIdAndUpdate(datasetId, { $inc: { imageCount: created.length } });
    return created;
  }

  listImages(datasetId: string, page = 1, limit = 60, filter: Record<string, any> = {}) {
    const skip = (page - 1) * limit;
    return Promise.all([
      this.imageModel.find({ datasetId, ...filter }).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.imageModel.countDocuments({ datasetId, ...filter }).exec(),
    ]);
  }

  classDistribution(datasetId: string) {
    return this.imageModel.aggregate([
      { $match: { datasetId } },
      { $group: { _id: '$label', count: { $sum: 1 } } },
    ]);
  }

  /** Deterministic 70/15/15-style split (ratios come from caller), stratified per class. */
  async applySplit(datasetId: string, valSplit: number, testSplit: number) {
    const dataset = await this.findById(datasetId);
    let totalAssigned = 0;

    for (const label of dataset.classes) {
      const images = await this.imageModel.find({ datasetId, label }).exec();
      const shuffled = [...images].sort(() => Math.random() - 0.5);
      const nVal = Math.round(shuffled.length * valSplit);
      const nTest = Math.round(shuffled.length * testSplit);

      const valIds = shuffled.slice(0, nVal).map((i) => i._id);
      const testIds = shuffled.slice(nVal, nVal + nTest).map((i) => i._id);
      const trainIds = shuffled.slice(nVal + nTest).map((i) => i._id);

      await Promise.all([
        this.imageModel.updateMany({ _id: { $in: valIds } }, { split: 'VAL' }).exec(),
        this.imageModel.updateMany({ _id: { $in: testIds } }, { split: 'TEST' }).exec(),
        this.imageModel.updateMany({ _id: { $in: trainIds } }, { split: 'TRAIN' }).exec(),
      ]);
      totalAssigned += shuffled.length;
    }

    await this.datasetModel.findByIdAndUpdate(datasetId, { status: 'SPLIT' });
    return { totalAssigned };
  }

  imagesBySplit(datasetId: string, split: 'TRAIN' | 'VAL' | 'TEST') {
    return this.imageModel.find({ datasetId, split }).exec();
  }
}
