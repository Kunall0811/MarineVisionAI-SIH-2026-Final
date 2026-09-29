import { Controller, Post, Get, Body, Query, UseGuards, BadRequestException, UseInterceptors, UploadedFile, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IntentParserService } from './intent-parser.service';
import { CommandExecutorService } from './command-executor.service';
import { LearningService } from './learning.service';
import { AuditService } from '../audit/audit.service';
import { ElevenLabsService } from './elevenlabs.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

@ApiTags('friday')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('friday')
export class FridayController {
  constructor(
    private intentParser: IntentParserService,
    private commandExecutor: CommandExecutorService,
    private learningService: LearningService,
    private auditService: AuditService,
    private elevenLabs: ElevenLabsService,
  ) {}

  /**
   * Full FRIDAY flow: transcript (already produced by the browser's Web
   * Speech STT) -> intent parsing -> permission-aware execution ->
   * structured result (frontend does TTS via speechSynthesis using
   * spokenResponse). Destructive intents pause for confirmation: the first
   * call returns { requiresConfirmation: true, interactionId }; the client
   * re-sends the same transcript with { confirm: true, interactionId } to
   * proceed, or does nothing to let it lapse.
   */
  @Post('command')
  async command(
    @CurrentUser() user: any,
    @Body() body: { transcript: string; confirm?: boolean; interactionId?: string },
  ) {
    if (!body.transcript || !body.transcript.trim()) {
      throw new BadRequestException({ success: false, error: { code: 'TRANSCRIPT_REQUIRED', message: 'transcript is required.' } });
    }

    // Resuming a previously-issued confirmation.
    if (body.confirm && body.interactionId) {
      const pending = await this.learningService.findById(body.interactionId);
      if (!pending || pending.status !== 'PENDING_CONFIRMATION' || String(pending.userId) !== user.userId) {
        throw new BadRequestException({ success: false, error: { code: 'INVALID_CONFIRMATION', message: 'No matching pending command to confirm.' } });
      }
      const parsed = { intent: pending.intent, parameters: pending.parameters, isDestructive: true, confidence: 1 };
      const result = await this.commandExecutor.execute(user, parsed as any);
      await this.learningService.updateInteraction(body.interactionId, {
        status: result.success ? 'EXECUTED' : 'FAILED',
        spokenResponse: result.spokenResponse,
        resultData: result.data,
      });
      await this.auditService.record({
        userId: user.userId, userEmail: user.email, userRole: user.role,
        action: 'FRIDAY_COMMAND_CONFIRMED', category: 'FRIDAY', targetId: body.interactionId,
        metadata: { intent: pending.intent, parameters: pending.parameters },
      });
      const suggestion = await this.learningService.proactiveSuggestion(user.userId, pending.intent);
      return { success: true, data: { requiresConfirmation: false, ...result, suggestion } };
    }

    const parsed = this.intentParser.parse(body.transcript);

    if (parsed.isDestructive) {
      const pending = await this.learningService.logInteraction({
        userId: user.userId,
        transcript: body.transcript,
        intent: parsed.intent,
        parameters: parsed.parameters,
        status: 'PENDING_CONFIRMATION',
        requiredConfirmation: true,
        spokenResponse: `This action requires confirmation: ${this.describeIntent(parsed.intent, parsed.parameters)}. Say confirm to proceed.`,
        resultData: {},
      });
      await this.auditService.record({
        userId: user.userId, userEmail: user.email, userRole: user.role,
        action: 'FRIDAY_CONFIRMATION_REQUESTED', category: 'FRIDAY', targetId: String(pending._id),
        metadata: { intent: parsed.intent, parameters: parsed.parameters },
      });
      return {
        success: true,
        data: {
          requiresConfirmation: true,
          interactionId: String(pending._id),
          spokenResponse: pending.spokenResponse,
          intent: parsed.intent,
          parameters: parsed.parameters,
        },
      };
    }

    const result = await this.commandExecutor.execute(user, parsed);
    const interaction = await this.learningService.logInteraction({
      userId: user.userId,
      transcript: body.transcript,
      intent: parsed.intent,
      parameters: parsed.parameters,
      status: result.success ? 'EXECUTED' : 'FAILED',
      requiredConfirmation: false,
      spokenResponse: result.spokenResponse,
      resultData: result.data,
    });

    await this.auditService.record({
      userId: user.userId, userEmail: user.email, userRole: user.role,
      action: 'FRIDAY_COMMAND_EXECUTED', category: 'FRIDAY', targetId: String(interaction._id),
      metadata: { intent: parsed.intent, parameters: parsed.parameters, success: result.success },
    });

    const suggestion = parsed.intent !== 'UNKNOWN' ? await this.learningService.proactiveSuggestion(user.userId, parsed.intent) : null;

    return { success: true, data: { requiresConfirmation: false, ...result, intent: parsed.intent, suggestion } };
  }


  @Get('voice-status')
  voiceStatus() {
    return {
      success: true,
      data: {
        configured: this.elevenLabs.isConfigured(),
        provider: 'ElevenLabs',
        sttModel: 'scribe_v2',
        ttsModel: 'eleven_multilingual_v2',
        voice: 'configured female voice',
      },
    };
  }

  @Post('stt')
  @UseInterceptors(FileInterceptor('audio', {
    storage: memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 },
  }))
  async speechToText(@UploadedFile() audio: Express.Multer.File) {
    if (!audio?.buffer?.length) {
      throw new BadRequestException({
        success: false,
        error: { code: 'AUDIO_REQUIRED', message: 'Audio file is required.' },
      });
    }
    const transcript = await this.elevenLabs.transcribe(audio.buffer, audio.mimetype || 'audio/webm');
    if (!transcript.text) {
      throw new BadRequestException({
        success: false,
        error: { code: 'EMPTY_TRANSCRIPT', message: 'No speech was detected.' },
      });
    }
    return { success: true, data: transcript };
  }

  @Post('tts')
  async textToSpeech(@Body() body: { text: string }, @Res() res: any) {
    if (!body?.text?.trim()) {
      throw new BadRequestException({
        success: false,
        error: { code: 'TEXT_REQUIRED', message: 'text is required.' },
      });
    }
    const audio = await this.elevenLabs.synthesize(body.text.trim());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.send(audio);
  }

  @Post('voice-command')
  @UseInterceptors(FileInterceptor('audio', {
    storage: memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 },
  }))
  async voiceCommand(@CurrentUser() user: any, @UploadedFile() audio: Express.Multer.File) {
    if (!audio?.buffer?.length) {
      throw new BadRequestException({
        success: false,
        error: { code: 'AUDIO_REQUIRED', message: 'Audio file is required.' },
      });
    }
    const transcript = await this.elevenLabs.transcribe(audio.buffer, audio.mimetype || 'audio/webm');
    if (!transcript.text) {
      throw new BadRequestException({
        success: false,
        error: { code: 'EMPTY_TRANSCRIPT', message: 'No speech was detected.' },
      });
    }
    const result = await this.command(user, { transcript: transcript.text });
    return {
      ...result,
      data: {
        ...(result.data || {}),
        transcript: transcript.text,
        languageCode: transcript.languageCode,
      },
    };
  }

  @Get('history')
  async history(@CurrentUser('userId') userId: string, @Query('limit') limit = '30') {
    const data = await this.learningService.history(userId, parseInt(limit, 10));
    return { success: true, data };
  }

  @Get('insights')
  async insights(@CurrentUser('userId') userId: string) {
    const [frequentCommands, frequentlyViewedClasses] = await Promise.all([
      this.learningService.frequentCommands(userId),
      this.learningService.frequentlyViewedClasses(userId),
    ]);
    return {
      success: true,
      data: {
        frequentCommands,
        frequentlyViewedClasses,
        note: 'Computed from your own logged FRIDAY command history only.',
      },
    };
  }

  private describeIntent(intent: string, params: Record<string, any>): string {
    switch (intent) {
      case 'START_PROCESSING':
        return `start processing survey ${params.surveyCode || '(unspecified)'}`;
      case 'SEND_REPORT':
        return `email the report for survey ${params.surveyCode || '(unspecified)'} to the authorized recipients`;
      case 'VERIFY_ANOMALY':
        return `mark anomaly ${params.anomalyCode || '(unspecified)'} as verified`;
      default:
        return intent;
    }
  }
}
