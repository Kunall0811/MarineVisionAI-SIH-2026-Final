import { Controller, Get } from '@nestjs/common';
import { AiInferenceService } from './modules/ai-inference/ai-inference.service';

@Controller('health')
export class HealthController {
  constructor(private readonly aiInference: AiInferenceService) {}

  @Get()
  health() {
    let aiStatus = 'ready (onnx yolo26x)';
    try {
      if (this.aiInference.isUsingPlaceholder()) {
        aiStatus = 'ready (placeholder heuristic)';
      }
    } catch {
      aiStatus = 'ready';
    }

    return {
      status: 'ok',
      database: 'not-required',
      storage: 'ready',
      ai: aiStatus,
      mode: 'IN_MEMORY_STORE',
      timestamp: new Date().toISOString(),
    };
  }
}

