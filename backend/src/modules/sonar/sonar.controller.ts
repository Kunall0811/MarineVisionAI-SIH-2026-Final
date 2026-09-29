import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  ForbiddenException,
  Res,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { InProcessQueueService } from '../../common/queue/in-process-queue.service';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import sharp from 'sharp';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SonarService } from './sonar.service';
import { SonarProcessingService } from './sonar-processing.service';
import { SurveysService } from '../surveys/surveys.service';
import { StorageService } from '../storage/storage.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { parseNavigationCsv, findNearestByTimestamp } from './navigation.util';

const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'tiff', 'xtf', 'jsf'];
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB per file (raw sonar files can be large)

function extractExtension(fileName: string): string {
  const parts = fileName.split('.');
  return (parts[parts.length - 1] || '').toLowerCase();
}

@ApiTags('sonar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sonar')
export class SonarController {
  private readonly logger = new Logger('SonarController');

  constructor(
    private sonarService: SonarService,
    private surveysService: SurveysService,
    private storage: StorageService,
    private realtime: RealtimeGateway,
    private inProcessQueue: InProcessQueueService,
    private sonarProcessingService: SonarProcessingService,
  ) {}

  private async assertUploadPermission(user: any, surveyId: string) {
    const survey = await this.surveysService.findById(surveyId);
    if (user.role === 'OPERATOR') {
      if (!this.surveysService.isOperatorAssigned(survey as any, user.userId)) {
        throw new ForbiddenException({
          success: false,
          error: { code: 'NOT_ASSIGNED', message: 'You are not assigned to this survey.' },
        });
      }
      if (user.operatorPermissions?.canUpload === false) {
        throw new ForbiddenException({
          success: false,
          error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'You do not have upload permission.' },
        });
      }
    }
    return survey;
  }

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_FILE_SIZE } }))
  async uploadSingle(
    @CurrentUser() user: any,
    @Body('surveyId') surveyId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!surveyId) {
      throw new BadRequestException({
        success: false,
        error: { code: 'SURVEY_ID_REQUIRED', message: 'surveyId is required.' },
      });
    }
    if (!file) {
      throw new BadRequestException({
        success: false,
        error: { code: 'FILE_REQUIRED', message: 'No file uploaded.' },
      });
    }
    const survey = await this.assertUploadPermission(user, surveyId);
    const frame = await this.storeAndQueueFrame(survey, file, user);
    return { success: true, data: frame };
  }

  @Post('batch-upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 2000, { storage: memoryStorage(), limits: { fileSize: MAX_FILE_SIZE } }))
  async uploadBatch(
    @CurrentUser() user: any,
    @Body('surveyId') surveyId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!surveyId) {
      throw new BadRequestException({
        success: false,
        error: { code: 'SURVEY_ID_REQUIRED', message: 'surveyId is required.' },
      });
    }
    if (!files || !files.length) {
      throw new BadRequestException({
        success: false,
        error: { code: 'FILES_REQUIRED', message: 'No files uploaded.' },
      });
    }

    const survey = await this.assertUploadPermission(user, surveyId);

    const results: any[] = [];
    const errors: any[] = [];

    // Sequential-but-fast storage writes; AI processing itself is queued to
    // BullMQ so this loop never blocks on inference (spec section 14).
    for (const file of files) {
      try {
        const frame = await this.storeAndQueueFrame(survey, file, user);
        results.push({ fileName: file.originalname, frameId: frame._id, status: 'QUEUED' });
      } catch (err: any) {
        errors.push({ fileName: file.originalname, status: 'SKIPPED', reason: err.message });
      }
    }

    this.realtime.emitEvent('sonar_uploaded', {
      surveyId: survey._id,
      uploaded: results.length,
      skipped: errors.length,
    });

    return {
      success: true,
      data: { queued: results.length, skipped: errors.length, results, errors },
    };
  }

  @Post('navigation/:surveyId')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadNavigationCsv(
    @CurrentUser() user: any,
    @Param('surveyId') surveyId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    await this.assertUploadPermission(user, surveyId);
    if (!file) {
      throw new BadRequestException({
        success: false,
        error: { code: 'FILE_REQUIRED', message: 'No navigation.csv uploaded.' },
      });
    }

    const { byFileName, byTimestamp } = parseNavigationCsv(file.buffer.toString('utf-8'));

    // Match every existing frame in this survey against the navigation data,
    // preferring exact filename match, falling back to nearest-timestamp.
    let matched = 0;
    let estimated = 0;
    let page = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const [frames, total] = await this.sonarService.findBySurvey(surveyId, page, 100);
      if (!frames.length) break;

      for (const frame of frames) {
        if (frame.navigationSource === 'REAL') continue; // don't overwrite confirmed data

        const byName = byFileName.get(frame.fileName);
        if (byName) {
          await this.sonarService.update(String(frame._id), {
            latitude: byName.latitude,
            longitude: byName.longitude,
            heading: byName.heading ?? null,
            depth: byName.depth ?? null,
            altitude: byName.altitude ?? null,
            heave: byName.heave ?? null,
            pitch: byName.pitch ?? null,
            roll: byName.roll ?? null,
            motionCorrectionStatus: byName.heave != null || byName.pitch != null || byName.roll != null ? 'FULL' : 'PARTIAL',
            range: byName.range ?? frame.range,
            side: (byName.side as any) ?? frame.side,
            navigationSource: 'REAL',
          });
          matched++;
          continue;
        }

        if (frame.timestamp) {
          const nearest = findNearestByTimestamp(byTimestamp, frame.timestamp.toISOString());
          if (nearest) {
            await this.sonarService.update(String(frame._id), {
              latitude: nearest.record.latitude,
              longitude: nearest.record.longitude,
              heading: nearest.record.heading ?? null,
              depth: nearest.record.depth ?? null,
              altitude: nearest.record.altitude ?? null,
              heave: nearest.record.heave ?? null,
              pitch: nearest.record.pitch ?? null,
              roll: nearest.record.roll ?? null,
              motionCorrectionStatus: nearest.record.heave != null || nearest.record.pitch != null || nearest.record.roll != null ? 'FULL' : 'PARTIAL',
              range: nearest.record.range ?? frame.range,
              side: (nearest.record.side as any) ?? frame.side,
              navigationSource: nearest.isEstimated ? 'ESTIMATED' : 'REAL',
            });
            nearest.isEstimated ? estimated++ : matched++;
          }
        }
      }

      if (page * 100 >= total) break;
      page++;
    }

    return { success: true, data: { matched, estimated } };
  }

  private async enqueueFrameSafely(frameId: string) {
    try {
      await this.inProcessQueue.add('process-frame', { frameId });
    } catch (err: any) {
      this.logger.warn(`Queue bypassed for frame ${frameId} (${err.message}); running in background`);
      setImmediate(() => {
        this.sonarProcessingService.processFrame(frameId).catch((e) => {
          this.logger.error(`Direct frame processing error: ${e.message}`);
        });
      });
    }
  }

  @Post(':id/process')
  async processFrame(@CurrentUser() user: any, @Param('id') id: string) {
    const frame = await this.sonarService.findById(id);
    const survey = await this.surveysService.findById(String(frame.surveyId));
    if (user.role === 'OPERATOR') {
      if (!this.surveysService.isOperatorAssigned(survey as any, user.userId)) {
        throw new ForbiddenException({
          success: false,
          error: { code: 'NOT_ASSIGNED', message: 'You are not assigned to this survey.' },
        });
      }
      if (user.operatorPermissions?.canProcess === false) {
        throw new ForbiddenException({
          success: false,
          error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'You do not have processing permission.' },
        });
      }
    }
    if (['xtf', 'jsf'].includes(frame.fileType)) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'RAW_SONAR_PARSER_REQUIRED',
          message: 'XTF/JSF ingestion is registered, but this build does not claim a production raw-log parser. Provide a validated parser before processing raw logs.',
        },
      });
    }
    await this.enqueueFrameSafely(id);
    return { success: true, data: { frameId: id, status: 'QUEUED' } };
  }

  @Post('survey/:surveyId/process-all')
  async processAllForSurvey(@CurrentUser() user: any, @Param('surveyId') surveyId: string) {
    const survey = await this.assertUploadPermission(user, surveyId);
    let page = 1;
    let queued = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const [frames, total] = await this.sonarService.findBySurvey(String(survey._id), page, 100, {
        processingStatus: 'QUEUED',
      });
      if (!frames.length) break;
      for (const frame of frames) {
        await this.enqueueFrameSafely(String(frame._id));
        queued++;
      }
      if (page * 100 >= total) break;
      page++;
    }
    await this.surveysService.update(String(survey._id), { status: 'PROCESSING' as any });
    return { success: true, data: { surveyId: String(survey._id), queued } };
  }

  @Get('survey/:surveyId')
  async listBySurvey(
    @Param('surveyId') surveyId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '500',
    @Query('status') status?: string,
  ) {
    let resolvedId = surveyId;
    const directSurvey = await this.surveysService.findById(surveyId);
    if (!directSurvey) {
      const s = await this.surveysService.findByCode(surveyId);
      if (s) resolvedId = String(s._id);
    }
    const filter: Record<string, any> = {};
    if (status) filter.processingStatus = status;
    const [frames, total] = await this.sonarService.findBySurvey(
      resolvedId,
      parseInt(page, 10),
      parseInt(limit, 10),
      filter,
    );
    return { success: true, data: frames, meta: { total, page: parseInt(page, 10), limit: parseInt(limit, 10) } };
  }

  @Get(':id')
  async getFrame(@Param('id') id: string) {
    const frame = await this.sonarService.findById(id);
    return { success: true, data: frame };
  }

  @Get(':id/image')
  async getFrameImage(@Param('id') id: string, @Res() res: Response) {
    const frame = await this.sonarService.findById(id);
    if (!this.storage.exists(frame.storagePath)) {
      res.status(404).json({
        success: false,
        error: { code: 'FILE_NOT_FOUND', message: 'Original sonar image not included in this deployment package.' },
      });
      return;
    }
    const buffer = this.storage.readFile(frame.storagePath);
    const contentType =
      frame.fileType === 'png' ? 'image/png' : ['jpg', 'jpeg'].includes(frame.fileType) ? 'image/jpeg' : 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  }

  @Get(':id/preprocessed-image')
  async getPreprocessedImage(@Param('id') id: string, @Res() res: Response) {
    const frame = await this.sonarService.findById(id);
    if (!frame.preprocessedStoragePath || !this.storage.exists(frame.preprocessedStoragePath)) {
      res.status(404).json({
        success: false,
        error: { code: 'FILE_NOT_FOUND', message: 'Preprocessed image not available yet.' },
      });
      return;
    }
    const buffer = this.storage.readFile(frame.preprocessedStoragePath);
    res.setHeader('Content-Type', 'image/png');
    res.send(buffer);
  }

  private async storeAndQueueFrame(survey: any, file: Express.Multer.File, user: any) {
    const ext = extractExtension(file.originalname);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new BadRequestException(
        `Unsupported file type ".${ext}". Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
      );
    }

    const existing = await this.sonarService.findByFileNameAndSurvey(String(survey._id), file.originalname);
    if (existing) {
      throw new BadRequestException(`File "${file.originalname}" was already uploaded to this survey.`);
    }

    const { storagePath, fileHash } = await this.storage.putFile(file.buffer, survey.code, file.originalname);

    let imageWidth: number | null = null;
    let imageHeight: number | null = null;
    if (['png', 'jpg', 'jpeg', 'tiff'].includes(ext)) {
      try {
        const meta = await sharp(file.buffer).metadata();
        imageWidth = meta.width || null;
        imageHeight = meta.height || null;
      } catch {
        // Not a decodable raster image (could be raw XTF/JSF) - dimensions
        // stay null until a format-specific parser extracts them.
      }
    }

    const frame = await this.sonarService.create({
      surveyId: survey._id,
      fileName: file.originalname,
      storagePath,
      fileHash,
      fileType: ext as any,
      imageWidth,
      imageHeight,
      processingStatus: 'QUEUED',
      navigationSource: 'UNAVAILABLE',
      // Admin uploads are trusted immediately. Operator uploads always land
      // as PENDING_REVIEW - they are analysed and shown to the operator,
      // but cannot enter the training dataset until an admin approves,
      // corrects, or rejects them (spec section 11/12).
      uploadedByRole: user?.role === 'OPERATOR' ? 'OPERATOR' : 'ADMIN',
      uploadedByUserId: user?.userId || null,
      reviewStatus: user?.role === 'OPERATOR' ? 'PENDING_REVIEW' : 'APPROVED',
    } as any);

    await this.surveysService.incrementFrameCounts(String(survey._id), { totalFrames: 1 });

    return frame;
  }
}
