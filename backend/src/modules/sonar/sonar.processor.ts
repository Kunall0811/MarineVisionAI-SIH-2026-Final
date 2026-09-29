import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SonarProcessingService } from './sonar-processing.service';
import { InProcessQueueService } from '../../common/queue/in-process-queue.service';

export interface SonarProcessingJobData {
  frameId: string;
}

/**
 * In-process worker - processes sonar frames off the HTTP request thread so
 * that uploading/processing images never blocks the API.
 */
@Injectable()
export class SonarQueueProcessor implements OnModuleInit {
  private readonly logger = new Logger('SonarQueueProcessor');

  constructor(
    private processingService: SonarProcessingService,
    private queue: InProcessQueueService,
  ) {}

  onModuleInit() {
    this.queue.registerHandler('process-frame', async (data: SonarProcessingJobData) => {
      this.logger.log(`Processing sonar frame job (frame ${data.frameId})`);
      return this.processingService.processFrame(data.frameId);
    });
  }

  async process(job: { data: SonarProcessingJobData }): Promise<any> {
    return this.processingService.processFrame(job.data.frameId);
  }
}
