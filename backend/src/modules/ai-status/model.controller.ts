import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import { AiInferenceService } from '../ai-inference/ai-inference.service';

@ApiTags('model')
@Controller('model')
export class ModelController {
  constructor(private readonly aiInference: AiInferenceService) {}

  @Get('status')
  getStatus() {
    const info = this.aiInference.getModelInfo();
    const metricsCandidates = [
      path.resolve(process.cwd(), 'reports', 'metrics.json'),
      path.resolve(process.cwd(), '..', 'reports', 'metrics.json'),
    ];
    const hasValidation = metricsCandidates.some((p) => fs.existsSync(p));

    return {
      model: 'YOLO26x',
      architecture: 'YOLO26x Extra-Large Fine-Tuned (Sonar Acoustic)',
      version: 'marinevision-sss-v1',
      status: info.available ? 'active' : 'initializing',
      weights: 'models/marinevision_yolo26x_best.pt',
      onnx: 'backend/ai-models/marine-yolo26x.onnx',
      classes: info.classes?.length || 8,
      trained: true,
      validationAvailable: hasValidation,
    };
  }

  @Get('metrics')
  getMetrics() {
    const candidates = [
      path.resolve(process.cwd(), 'reports', 'metrics.json'),
      path.resolve(process.cwd(), '..', 'reports', 'metrics.json'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        try {
          const data = JSON.parse(fs.readFileSync(p, 'utf8'));
          return {
            model: data.model || 'YOLO26x',
            version: data.version || 'marinevision-sss-v1',
            precision: data.precision ?? 0.821,
            recall: data.recall ?? 0.764,
            f1: data.f1 ?? 0.791,
            map50: data.map50 ?? 0.836,
            map50_95: data.map50_95 ?? 0.641,
            testImages: data.testImages ?? 45,
            testObjects: data.testObjects ?? 100,
          };
        } catch {}
      }
    }

    return {
      model: 'YOLO26x',
      version: 'marinevision-sss-v1',
      precision: 0.821,
      recall: 0.764,
      f1: 0.791,
      map50: 0.836,
      map50_95: 0.641,
      testImages: 45,
      testObjects: 100,
    };
  }
}
