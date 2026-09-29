import { Global, Module } from '@nestjs/common';
import { InProcessQueueService } from './in-process-queue.service';

@Global()
@Module({
  providers: [InProcessQueueService],
  exports: [InProcessQueueService],
})
export class InProcessQueueModule {}
