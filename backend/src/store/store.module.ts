import { Global, Module } from '@nestjs/common';
import { MemoryStore } from './memoryStore';

@Global()
@Module({
  providers: [MemoryStore],
  exports: [MemoryStore],
})
export class StoreModule {}
