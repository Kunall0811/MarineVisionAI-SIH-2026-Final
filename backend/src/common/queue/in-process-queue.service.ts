import { Injectable, Logger } from '@nestjs/common';

export interface JobCounts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

export type JobHandler<T = any> = (data: T) => Promise<any>;

interface QueuedItem<T = any> {
  id: string;
  name: string;
  data: T;
  resolve: (val: any) => void;
  reject: (err: any) => void;
}

@Injectable()
export class InProcessQueueService {
  private readonly logger = new Logger('InProcessQueueService');

  private waitingQueue: QueuedItem[] = [];
  private activeJobs = new Map<string, QueuedItem>();
  private completedCount = 0;
  private failedCount = 0;
  private concurrency = 4;
  private handlers = new Map<string, JobHandler>();

  registerHandler(name: string, handler: JobHandler): void {
    this.handlers.set(name, handler);
  }

  setConcurrency(concurrency: number): void {
    this.concurrency = Math.max(1, concurrency);
  }

  async add<T = any>(name: string, data: T, options?: any): Promise<{ id: string }> {
    const id = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return new Promise<{ id: string }>((resolveInit) => {
      new Promise((resolve, reject) => {
        this.waitingQueue.push({ id, name, data, resolve, reject });
        resolveInit({ id });
        setImmediate(() => this.processNext());
      });
    });
  }

  private async processNext(): Promise<void> {
    if (this.activeJobs.size >= this.concurrency || this.waitingQueue.length === 0) {
      return;
    }

    const item = this.waitingQueue.shift();
    if (!item) return;

    this.activeJobs.set(item.id, item);

    setImmediate(async () => {
      try {
        const handler = this.handlers.get(item.name);
        if (handler) {
          const result = await handler(item.data);
          item.resolve(result);
        } else {
          this.logger.warn(`No handler registered for job type: ${item.name}`);
          item.resolve(null);
        }
        this.completedCount++;
      } catch (err: any) {
        this.logger.error(`Job ${item.id} (${item.name}) failed: ${err.message}`, err.stack);
        this.failedCount++;
        item.reject(err);
      } finally {
        this.activeJobs.delete(item.id);
        setImmediate(() => this.processNext());
      }
    });
  }

  async getJobCounts(...types: string[]): Promise<JobCounts> {
    return {
      waiting: this.waitingQueue.length,
      active: this.activeJobs.size,
      completed: this.completedCount,
      failed: this.failedCount,
    };
  }
}
