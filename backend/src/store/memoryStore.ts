import { Injectable, Logger } from '@nestjs/common';
import {
  BaseEntity,
  generateId,
  User,
  Survey,
  SonarFrame,
  Detection,
  Report,
  Notification,
  WaterBody,
  AuditLog,
  EmailLog,
  EmailRecipient,
  HistoricalReference,
  FridayInteraction,
  TrainingJob,
  Dataset,
  DatasetImage,
  ModelVersion,
} from './types';

// Helper for deep property access (e.g. 'route.coordinates')
function getNestedValue(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

// Helper for deep property setting
function setNestedValue(obj: any, path: string, value: any): void {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] == null || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}

// Haversine distance in metres
function haversineDistance(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const R = 6371000; // metres
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Point in polygon test (ray-casting)
function pointInPolygon(point: [number, number], polygon: number[][][]): boolean {
  const [x, y] = point; // [lng, lat]
  let inside = false;
  // Consider outer ring
  const ring = polygon[0];
  if (!ring || ring.length < 3) return false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Evaluates a single condition against a document value
function evaluateCondition(docVal: any, cond: any): boolean {
  if (cond === null || cond === undefined) {
    return docVal === null || docVal === undefined;
  }

  // Primitive equality (with string fallback for ObjectId-like comparisons)
  if (typeof cond !== 'object' || cond instanceof Date) {
    if (docVal === cond) return true;
    if (docVal != null && cond != null && String(docVal) === String(cond)) return true;
    if (Array.isArray(docVal)) {
      return docVal.some((item) => String(item) === String(cond));
    }
    return false;
  }

  // Operators
  if ('$in' in cond && Array.isArray(cond.$in)) {
    const set = cond.$in.map(String);
    if (Array.isArray(docVal)) {
      return docVal.some((item) => set.includes(String(item)));
    }
    return set.includes(String(docVal));
  }

  if ('$nin' in cond && Array.isArray(cond.$nin)) {
    const set = cond.$nin.map(String);
    if (Array.isArray(docVal)) {
      return !docVal.some((item) => set.includes(String(item)));
    }
    return !set.includes(String(docVal));
  }

  if ('$ne' in cond) {
    if (cond.$ne === null) return docVal !== null && docVal !== undefined;
    return String(docVal) !== String(cond.$ne);
  }

  if ('$exists' in cond) {
    const exists = docVal !== undefined && docVal !== null;
    return exists === Boolean(cond.$exists);
  }

  if ('$regex' in cond) {
    const flags = cond.$options || '';
    const re = typeof cond.$regex === 'string' ? new RegExp(cond.$regex, flags) : cond.$regex;
    return re.test(String(docVal || ''));
  }

  if ('$gt' in cond && (docVal <= cond.$gt || docVal == null)) return false;
  if ('$gte' in cond && (docVal < cond.$gte || docVal == null)) return false;
  if ('$lt' in cond && (docVal >= cond.$lt || docVal == null)) return false;
  if ('$lte' in cond && (docVal > cond.$lte || docVal == null)) return false;

  // Geospatial $near
  if ('$near' in cond && cond.$near?.$geometry?.coordinates) {
    const [targetLng, targetLat] = cond.$near.$geometry.coordinates;
    const maxDist = cond.$near.$maxDistance ?? Infinity;
    if (!docVal || !docVal.coordinates) return false;
    const [docLng, docLat] = docVal.coordinates;
    const dist = haversineDistance(docLng, docLat, targetLng, targetLat);
    return dist <= maxDist;
  }

  // Geospatial $geoWithin $box
  if ('$geoWithin' in cond && cond.$geoWithin?.$box) {
    const [[swLng, swLat], [neLng, neLat]] = cond.$geoWithin.$box;
    if (!docVal || !docVal.coordinates) return false;
    const [docLng, docLat] = docVal.coordinates;
    return docLng >= swLng && docLng <= neLng && docLat >= swLat && docLat <= neLat;
  }

  // Geospatial $geoIntersects
  if ('$geoIntersects' in cond && cond.$geoIntersects?.$geometry?.coordinates) {
    const [ptLng, ptLat] = cond.$geoIntersects.$geometry.coordinates;
    if (!docVal || !docVal.coordinates) return false;
    return pointInPolygon([ptLng, ptLat], docVal.coordinates);
  }

  return true;
}

// Matches a complete filter against a document
function matchFilter(doc: any, filter: Record<string, any>): boolean {
  if (!filter || Object.keys(filter).length === 0) return true;

  if (Array.isArray(filter.$or)) {
    return filter.$or.some((subFilter) => matchFilter(doc, subFilter));
  }

  for (const [key, cond] of Object.entries(filter)) {
    if (key === '$or') continue;
    const docVal = key.includes('.') ? getNestedValue(doc, key) : doc[key];
    if (!evaluateCondition(docVal, cond)) {
      return false;
    }
  }

  return true;
}

// Applies update operations to a document in-place
function applyUpdate(doc: any, update: any): void {
  if (!update || typeof update !== 'object') return;

  // Handle $set
  if (update.$set) {
    for (const [k, v] of Object.entries(update.$set)) {
      if (k.includes('.')) setNestedValue(doc, k, v);
      else doc[k] = v;
    }
  }

  // Handle $inc
  if (update.$inc) {
    for (const [k, v] of Object.entries(update.$inc)) {
      const current = (k.includes('.') ? getNestedValue(doc, k) : doc[k]) || 0;
      const nextVal = current + Number(v);
      if (k.includes('.')) setNestedValue(doc, k, nextVal);
      else doc[k] = nextVal;
    }
  }

  // Handle $push
  if (update.$push) {
    for (const [k, v] of Object.entries(update.$push)) {
      let arr = k.includes('.') ? getNestedValue(doc, k) : doc[k];
      if (!Array.isArray(arr)) {
        arr = [];
        if (k.includes('.')) setNestedValue(doc, k, arr);
        else doc[k] = arr;
      }
      arr.push(v);
    }
  }

  // Handle $addToSet
  if (update.$addToSet) {
    for (const [k, v] of Object.entries(update.$addToSet)) {
      let arr = k.includes('.') ? getNestedValue(doc, k) : doc[k];
      if (!Array.isArray(arr)) {
        arr = [];
        if (k.includes('.')) setNestedValue(doc, k, arr);
        else doc[k] = arr;
      }
      const itemsToAdd = (v as any)?.$each && Array.isArray((v as any).$each) ? (v as any).$each : [v];
      for (const item of itemsToAdd) {
        if (!arr.some((existing: any) => String(existing) === String(item))) {
          arr.push(item);
        }
      }
    }
  }

  // Handle root properties (non-operators)
  for (const [k, v] of Object.entries(update)) {
    if (k.startsWith('$')) continue;
    if (k.includes('.')) setNestedValue(doc, k, v);
    else doc[k] = v;
  }

  doc.updatedAt = new Date();
}

/**
 * Chainable query object imitating Mongoose Query interface
 * Supports: .sort(), .skip(), .limit(), .select(), .lean(), .exec(), and thenable (await)
 */
export class MemoryQuery<T> implements PromiseLike<T> {
  private sortFn?: (a: any, b: any) => number;
  private skipCount = 0;
  private limitCount = Infinity;
  private selectedFields?: string[];

  constructor(private readonly resolver: (query: MemoryQuery<T>) => T | Promise<T>) {}

  sort(sortCriteria: Record<string, 1 | -1 | 'asc' | 'desc'> | string): this {
    if (!sortCriteria) return this;
    const entries: [string, number][] = [];
    if (typeof sortCriteria === 'string') {
      const parts = sortCriteria.split(/\s+/).filter(Boolean);
      for (const p of parts) {
        if (p.startsWith('-')) entries.push([p.slice(1), -1]);
        else entries.push([p, 1]);
      }
    } else {
      for (const [k, v] of Object.entries(sortCriteria)) {
        entries.push([k, v === -1 || v === 'desc' ? -1 : 1]);
      }
    }

    this.sortFn = (a: any, b: any) => {
      for (const [field, dir] of entries) {
        const valA = getNestedValue(a, field);
        const valB = getNestedValue(b, field);
        if (valA === valB) continue;
        if (valA == null) return 1;
        if (valB == null) return -1;
        if (valA > valB) return dir;
        if (valA < valB) return -dir;
      }
      return 0;
    };
    return this;
  }

  skip(count: number): this {
    this.skipCount = Math.max(0, count || 0);
    return this;
  }

  limit(count: number): this {
    this.limitCount = Math.max(0, count || 0);
    return this;
  }

  select(fields: string | Record<string, number>): this {
    if (typeof fields === 'string') {
      this.selectedFields = fields.split(/\s+/).filter(Boolean);
    }
    return this;
  }

  lean(): this {
    return this;
  }

  async exec(): Promise<T> {
    return await this.resolver(this);
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.exec().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null,
  ): Promise<T | TResult> {
    return this.exec().catch(onrejected);
  }

  applyTransforms<E>(items: E[]): E[] {
    let result = [...items];
    if (this.sortFn) {
      result.sort(this.sortFn);
    }
    if (this.skipCount > 0) {
      result = result.slice(this.skipCount);
    }
    if (this.limitCount < Infinity) {
      result = result.slice(0, this.limitCount);
    }
    return result;
  }
}

/**
 * Generic In-Memory Collection imitating Mongoose Model API
 */
export class MemoryCollection<T extends BaseEntity> {
  private readonly items = new Map<string, T>();

  constructor(public readonly collectionName: string) {}

  get size(): number {
    return this.items.size;
  }

  async create(data: Partial<T>): Promise<T> {
    const id = (data as any)?._id ? String((data as any)._id) : generateId();
    const now = new Date();
    const doc: any = {
      ...data,
      _id: id,
      id,
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
    };
    this.items.set(id, doc as T);
    return JSON.parse(JSON.stringify(doc));
  }

  async insertMany(items: Array<Partial<T>>): Promise<T[]> {
    const created: T[] = [];
    for (const item of items) {
      created.push(await this.create(item));
    }
    return created;
  }

  findById(id: string): MemoryQuery<T | null> {
    return new MemoryQuery(() => {
      if (!id) return null;
      const doc = this.items.get(String(id));
      return doc ? JSON.parse(JSON.stringify(doc)) : null;
    });
  }

  findOne(filter: Record<string, any> = {}): MemoryQuery<T | null> {
    return new MemoryQuery(() => {
      for (const doc of this.items.values()) {
        if (matchFilter(doc, filter)) {
          return JSON.parse(JSON.stringify(doc));
        }
      }
      return null;
    });
  }

  find(filter: Record<string, any> = {}): MemoryQuery<T[]> {
    return new MemoryQuery((q) => {
      const matched: T[] = [];
      for (const doc of this.items.values()) {
        if (matchFilter(doc, filter)) {
          matched.push(JSON.parse(JSON.stringify(doc)));
        }
      }
      return q.applyTransforms(matched);
    });
  }

  findByIdAndUpdate(id: string, update: any, options: { new?: boolean } = { new: true }): MemoryQuery<T | null> {
    return new MemoryQuery(() => {
      if (!id) return null;
      const doc = this.items.get(String(id));
      if (!doc) return null;
      applyUpdate(doc, update);
      return JSON.parse(JSON.stringify(doc));
    });
  }

  findOneAndUpdate(
    filter: Record<string, any>,
    update: any,
    options: { new?: boolean; upsert?: boolean } = { new: true },
  ): MemoryQuery<T | null> {
    return new MemoryQuery(async () => {
      let doc: any = null;
      for (const d of this.items.values()) {
        if (matchFilter(d, filter)) {
          doc = d;
          break;
        }
      }

      if (!doc) {
        if (options.upsert) {
          const initial: any = { ...filter };
          // Remove filter operators from initial doc
          for (const k of Object.keys(initial)) {
            if (typeof initial[k] === 'object' && initial[k] !== null && !Array.isArray(initial[k])) {
              delete initial[k];
            }
          }
          const created = await this.create(initial);
          doc = this.items.get(created._id);
        } else {
          return null;
        }
      }

      applyUpdate(doc, update);
      return JSON.parse(JSON.stringify(doc));
    });
  }

  findByIdAndDelete(id: string): MemoryQuery<T | null> {
    return new MemoryQuery(() => {
      if (!id) return null;
      const strId = String(id);
      const doc = this.items.get(strId);
      if (doc) {
        this.items.delete(strId);
        return JSON.parse(JSON.stringify(doc));
      }
      return null;
    });
  }

  deleteMany(filter: Record<string, any> = {}): MemoryQuery<{ deletedCount: number }> {
    return new MemoryQuery(() => {
      let count = 0;
      for (const [id, doc] of Array.from(this.items.entries())) {
        if (matchFilter(doc, filter)) {
          this.items.delete(id);
          count++;
        }
      }
      return { deletedCount: count };
    });
  }

  updateMany(filter: Record<string, any>, update: any): MemoryQuery<{ modifiedCount: number }> {
    return new MemoryQuery(() => {
      let count = 0;
      for (const doc of this.items.values()) {
        if (matchFilter(doc, filter)) {
          applyUpdate(doc, update);
          count++;
        }
      }
      return { modifiedCount: count };
    });
  }

  countDocuments(filter: Record<string, any> = {}): MemoryQuery<number> {
    return new MemoryQuery(() => {
      let count = 0;
      for (const doc of this.items.values()) {
        if (matchFilter(doc, filter)) {
          count++;
        }
      }
      return count;
    });
  }

  distinct(field: string): MemoryQuery<any[]> {
    return new MemoryQuery(() => {
      const set = new Set<any>();
      for (const doc of this.items.values()) {
        const val = getNestedValue(doc, field);
        if (val !== undefined && val !== null) {
          if (Array.isArray(val)) {
            val.forEach((x) => set.add(x));
          } else {
            set.add(val);
          }
        }
      }
      return Array.from(set);
    });
  }

  async aggregate(pipeline: any[] = []): Promise<any[]> {
    let current: any[] = Array.from(this.items.values()).map((d) => JSON.parse(JSON.stringify(d)));

    for (const stage of pipeline) {
      if (stage.$match) {
        current = current.filter((doc) => matchFilter(doc, stage.$match));
      }

      if (stage.$group) {
        const groupField = stage.$group._id;
        const groups = new Map<any, { _id: any; count: number }>();
        for (const doc of current) {
          let key: any;
          if (typeof groupField === 'string' && groupField.startsWith('$')) {
            key = getNestedValue(doc, groupField.slice(1));
          } else {
            key = groupField;
          }
          if (key === undefined) key = null;
          const existing = groups.get(key) || { _id: key, count: 0 };
          existing.count += 1;
          groups.set(key, existing);
        }
        current = Array.from(groups.values());
      }

      if (stage.$sort) {
        const sortEntries = Object.entries(stage.$sort);
        current.sort((a, b) => {
          for (const [k, v] of sortEntries) {
            const valA = getNestedValue(a, k);
            const valB = getNestedValue(b, k);
            if (valA === valB) continue;
            if (valA == null) return 1;
            if (valB == null) return -1;
            return v === -1 ? (valA < valB ? 1 : -1) : valA > valB ? 1 : -1;
          }
          return 0;
        });
      }

      if (stage.$limit && typeof stage.$limit === 'number') {
        current = current.slice(0, stage.$limit);
      }
    }

    return current;
  }

  async bulkWrite(operations: any[]): Promise<{ upsertedCount: number; modifiedCount: number }> {
    let upsertedCount = 0;
    let modifiedCount = 0;
    for (const op of operations) {
      if (op.updateOne) {
        const { filter, update, upsert } = op.updateOne;
        const existing = await this.findOne(filter).exec();
        if (existing) {
          await this.findOneAndUpdate(filter, update, { new: true }).exec();
          modifiedCount++;
        } else if (upsert) {
          await this.findOneAndUpdate(filter, update, { new: true, upsert: true }).exec();
          upsertedCount++;
        }
      }
    }
    return { upsertedCount, modifiedCount };
  }

  clear(): void {
    this.items.clear();
  }
}

/**
 * Central MarineVision In-Memory Store
 */
@Injectable()
export class MemoryStore {
  private readonly logger = new Logger('MemoryStore');

  public readonly users = new MemoryCollection<User>('users');
  public readonly surveys = new MemoryCollection<Survey>('surveys');
  public readonly sonarFrames = new MemoryCollection<SonarFrame>('sonar_frames');
  public readonly detections = new MemoryCollection<Detection>('detections');
  public readonly reports = new MemoryCollection<Report>('reports');
  public readonly notifications = new MemoryCollection<Notification>('notifications');
  public readonly waterBodies = new MemoryCollection<WaterBody>('water_bodies');
  public readonly auditLogs = new MemoryCollection<AuditLog>('audit_logs');
  public readonly emailLogs = new MemoryCollection<EmailLog>('email_logs');
  public readonly emailRecipients = new MemoryCollection<EmailRecipient>('email_recipients');
  public readonly historicalReferences = new MemoryCollection<HistoricalReference>('historical_references');
  public readonly fridayInteractions = new MemoryCollection<FridayInteraction>('friday_interactions');
  public readonly trainingJobs = new MemoryCollection<TrainingJob>('training_jobs');
  public readonly datasets = new MemoryCollection<Dataset>('datasets');
  public readonly datasetImages = new MemoryCollection<DatasetImage>('dataset_images');
  public readonly modelVersions = new MemoryCollection<ModelVersion>('model_versions');

  constructor() {
    this.logger.log('MarineVision In-Memory Store initialized. External database not required.');
  }

  get stats() {
    return {
      users: this.users.size,
      surveys: this.surveys.size,
      sonarFrames: this.sonarFrames.size,
      detections: this.detections.size,
      reports: this.reports.size,
      notifications: this.notifications.size,
      waterBodies: this.waterBodies.size,
      historicalReferences: this.historicalReferences.size,
      trainingJobs: this.trainingJobs.size,
      datasets: this.datasets.size,
      modelVersions: this.modelVersions.size,
    };
  }

  clearAll(): void {
    this.users.clear();
    this.surveys.clear();
    this.sonarFrames.clear();
    this.detections.clear();
    this.reports.clear();
    this.notifications.clear();
    this.waterBodies.clear();
    this.auditLogs.clear();
    this.emailLogs.clear();
    this.emailRecipients.clear();
    this.historicalReferences.clear();
    this.fridayInteractions.clear();
    this.trainingJobs.clear();
    this.datasets.clear();
    this.datasetImages.clear();
    this.modelVersions.clear();
  }
}
