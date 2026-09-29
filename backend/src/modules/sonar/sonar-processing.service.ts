import { Injectable, Logger } from '@nestjs/common';
import { SonarService } from './sonar.service';
import { SurveysService } from '../surveys/surveys.service';
import { DetectionsService } from '../detections/detections.service';
import { AiInferenceService } from '../ai-inference/ai-inference.service';
import { GeolocationService } from '../geolocation/geolocation.service';
import { StorageService } from '../storage/storage.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { MailEventsService } from '../mail/mail-events.service';
import { classifyRisk } from '../detections/risk-classifier';

/**
 * Orchestrates the full per-frame pipeline required by the spec:
 * PREPROCESSING -> AI INFERENCE -> SHADOW ANALYSIS -> GEOLOCATION ->
 * RISK CLASSIFICATION -> MONGODB -> REAL-TIME UPDATE -> (email if high risk)
 */
@Injectable()
export class SonarProcessingService {
  private readonly logger = new Logger('SonarProcessingService');

  constructor(
    private sonarService: SonarService,
    private surveysService: SurveysService,
    private detectionsService: DetectionsService,
    private aiInference: AiInferenceService,
    private geolocation: GeolocationService,
    private storage: StorageService,
    private realtime: RealtimeGateway,
    private mailEvents: MailEventsService,
  ) {}

  async processFrame(frameId: string) {
    const frame = await this.sonarService.findById(frameId);
    const survey = await this.surveysService.findById(String(frame.surveyId));

    try {
      await this.sonarService.update(frameId, { processingStatus: 'PREPROCESSING' });
      this.realtime.emitEvent('processing_started', { frameId, surveyId: frame.surveyId });

      const absolutePath = this.storage.getAbsolutePath(frame.storagePath);

      // Domain validity gate (spec section 12: "wrong image" protection).
      // Runs before quality assessment / inference so a selfie, screenshot
      // or random photo never reaches the detector and never gets stored
      // as if it were sonar data.
      const domainValidity = await this.aiInference.assessSonarDomainValidity(absolutePath);
      await this.sonarService.update(frameId, { domainValidity });
      if (!domainValidity.isSonarLike) {
        await this.sonarService.update(frameId, {
          processingStatus: 'INVALID_INPUT',
          processingError:
            'This image does not appear to contain Side-Scan Sonar imagery. It was not analysed as a detection and was not added to the training dataset.',
        });
        this.realtime.emitEvent('frame_invalid_input', {
          frameId,
          surveyId: frame.surveyId,
          sonarProbability: domainValidity.sonarProbability,
          reasons: domainValidity.reasons,
        });
        this.logger.warn(`Frame ${frameId} rejected as non-sonar input (p=${domainValidity.sonarProbability}).`);
        await this.maybeCompleteSurvey(survey);
        return;
      }

      const quality = await this.aiInference.assessQuality(absolutePath);
      await this.sonarService.update(frameId, {
        dropoutRatio: quality.dropoutRatio,
        qualityStatus: quality.qualityStatus,
        imageQualityScore: quality.imageQualityScore,
      });
      if (quality.qualityStatus === 'UNUSABLE') {
        throw new Error('Sonar frame is unusable after quality assessment; AI inference was not run.');
      }
      const preprocessed = await this.aiInference.preprocess(absolutePath);

      await this.sonarService.update(frameId, {
        processingStatus: 'INFERENCE',
        preprocessingVersion: preprocessed.preprocessingVersion,
        preprocessingParameters: preprocessed.preprocessingParameters,
        imageWidth: preprocessed.width,
        imageHeight: preprocessed.height,
      });

      let rawDetections =
        frame.imageWidth && frame.imageHeight && (frame.imageWidth > 1024 || frame.imageHeight > 1024)
          ? (await this.aiInference.detectTiled(absolutePath, { tileSize: 1024, overlap: 0.2 })).detections
          : await this.aiInference.detect(preprocessed, preprocessed.width, preprocessed.height);

      if (rawDetections.length === 0) {
        const acousticBoxes = await this.aiInference.extractAcousticFeatureBoxes(
          absolutePath,
          preprocessed.width,
          preprocessed.height,
        );
        rawDetections = acousticBoxes.map((b) => ({
          class: b.className,
          confidence: b.confidence,
          bbox: {
            x1: b.bbox.x,
            y1: b.bbox.y,
            x2: b.bbox.x + b.bbox.width,
            y2: b.bbox.y + b.bbox.height,
          },
        }));
      }

      let createdCount = 0;
      for (const raw of rawDetections) {
        // bbox from detect() is already rescaled to ORIGINAL image dims;
        // recompute the 640-space bbox for shadow analysis consistency.
        const scaleX = 640 / preprocessed.width;
        const scaleY = 640 / preprocessed.height;
        const bbox640 = {
          x1: raw.bbox.x1 * scaleX,
          y1: raw.bbox.y1 * scaleY,
          x2: raw.bbox.x2 * scaleX,
          y2: raw.bbox.y2 * scaleY,
        };

        const shadow = await this.aiInference.analyzeShadowAndMaterial(preprocessed, bbox640, raw.class);

        const finalConfidence = Number(raw.confidence.toFixed(4));

        const nav = {
          latitude: frame.latitude,
          longitude: frame.longitude,
          heading: frame.heading,
          range: frame.range,
          side: frame.side,
          navigationSource: frame.navigationSource,
          depth: frame.depth,
        };

        const geo = this.geolocation.computeDetectionLocation(
          nav,
          raw.bbox,
          preprocessed.width,
          preprocessed.height,
        );

        const riskLevel = classifyRisk({
          finalConfidence,
          objectClass: raw.class,
          lengthMetres: geo.lengthMetres,
          depth: geo.depth,
          status: 'PENDING_REVIEW',
        });

        const anomalyCode = await this.detectionsService.nextAnomalyCode(String(survey._id));

        const detection = await this.detectionsService.create({
          surveyId: survey._id,
          sonarFrameId: frame._id,
          anomalyCode,
          class: raw.class,
          confidence: raw.confidence,
          finalConfidence,
          bbox: raw.bbox,
          latitude: geo.latitude,
          longitude: geo.longitude,
          depth: geo.depth,
          length: geo.lengthMetres,
          width: geo.widthMetres,
          artificialProbability: shadow.artificialProbability,
          naturalProbability: shadow.naturalProbability,
          shadowScore: shadow.shadowScore,
          noiseScore: shadow.noiseScore,
          riskLevel,
          status: 'PENDING_REVIEW',
          modelVersion: this.aiInference.modelVersion,
          locationStatus: geo.locationStatus,
          dataType: survey.dataType as any,
          location:
            geo.latitude !== null && geo.longitude !== null
              ? { type: 'Point', coordinates: [geo.longitude, geo.latitude] }
              : null,
        } as any);

        createdCount++;

        this.realtime.emitEvent('detection_created', {
          detectionId: detection._id,
          surveyId: survey._id,
          anomalyCode,
          class: raw.class,
          confidence: finalConfidence,
          riskLevel,
          locationStatus: geo.locationStatus,
        });

        this.realtime.emitEvent('anomaly_created', {
          id: String(detection._id),
          anomalyId: anomalyCode,
          surveyId: String(survey._id),
          sonarFrameId: String(frame._id),
          type: raw.class,
          confidence: finalConfidence,
          latitude: geo.latitude,
          longitude: geo.longitude,
          depth: geo.depth,
          length: geo.lengthMetres,
          width: geo.widthMetres,
          status: 'detected',
          riskLevel,
          sourceType: String(survey.dataType).toLowerCase(),
          coordinateSource: 'ESTIMATED_FROM_SONAR_GEOMETRY',
          timestamp: new Date(),
        });

        if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
          this.realtime.emitEvent('alert_created', {
            detectionId: detection._id,
            anomalyCode,
            class: raw.class,
            riskLevel,
          });
          // High-risk alert is dispatched through the BullMQ 'mail' queue so
          // it never blocks the processing pipeline; MailQueueProcessor
          // resolves the actual authorized recipients subscribed to this
          // event, sends the email, logs it, and mirrors it as a
          // Notification for every Admin.
          this.mailEvents
            .dispatch(
              'HIGH_RISK_ANOMALY',
              `URGENT MARINE ANOMALY DETECTED - ${raw.class.replace(/_/g, ' ')} (${anomalyCode})`,
              `<div style="font-family:sans-serif;max-width:560px;margin:auto">
                 <h2 style="color:#b91c1c">High-Risk Anomaly Detected</h2>
                 <table style="width:100%;border-collapse:collapse">
                   <tr><td><b>Anomaly</b></td><td>${anomalyCode}</td></tr>
                   <tr><td><b>Survey</b></td><td>${survey.name} (${survey.code})</td></tr>
                   <tr><td><b>Classification</b></td><td>${raw.class}</td></tr>
                   <tr><td><b>AI Confidence</b></td><td>${Math.round(finalConfidence * 100)}%</td></tr>
                   <tr><td><b>Coordinates</b></td><td>${geo.latitude ?? 'N/A'}, ${geo.longitude ?? 'N/A'}</td></tr>
                   <tr><td><b>Depth</b></td><td>${geo.depth ?? 'N/A'} m</td></tr>
                   <tr><td><b>Coordinate source</b></td><td>${geo.locationStatus}</td></tr>
                 </table>
                 <p style="color:#888;font-size:12px">Automated alert based on system-configured risk rules. Requires expert verification before any operational action.</p>
               </div>`,
              `High-risk anomaly ${anomalyCode} (${raw.class}) detected in survey ${survey.name}. Confidence ${Math.round(finalConfidence * 100)}%.`,
              { detectionId: String(detection._id), anomalyCode, riskLevel, severity: riskLevel },
            )
            .catch((err) => this.logger.warn(`High-risk alert dispatch failed: ${err.message}`));
        }

        // Extend survey's route track with a real navigation fix (not invented).
        if (geo.locationStatus !== 'UNAVAILABLE' && frame.latitude && frame.longitude) {
          await this.surveysService.appendRoutePoint(String(survey._id), frame.longitude, frame.latitude);
        }
      }

      await this.sonarService.update(frameId, {
        processingStatus: 'COMPLETED',
        processedAt: new Date(),
      });
      const updatedSurvey = await this.surveysService.incrementFrameCounts(String(survey._id), { processedFrames: 1 });

      this.realtime.emitEvent('processing_progress', {
        surveyId: survey._id,
        frameId,
        status: 'COMPLETED',
        detectionsCreated: createdCount,
      });

      await this.maybeCompleteSurvey(updatedSurvey);

      return { frameId, detectionsCreated: createdCount };
    } catch (err: any) {
      this.logger.error(`Frame ${frameId} processing failed: ${err.message}`, err.stack);
      await this.sonarService.update(frameId, {
        processingStatus: 'FAILED',
        processingError: err.message,
      });
      const updatedSurvey = await this.surveysService.incrementFrameCounts(String(frame.surveyId), { failedFrames: 1 });
      this.realtime.emitEvent('processing_progress', {
        surveyId: frame.surveyId,
        frameId,
        status: 'FAILED',
        error: err.message,
      });

      this.mailEvents
        .dispatch(
          'PROCESSING_FAILURE',
          `Sonar frame processing failed - Survey ${survey.code}`,
          `<div style="font-family:sans-serif"><p>Frame <b>${frame.fileName}</b> in survey <b>${survey.name}</b> (${survey.code}) failed processing.</p><p>Error: ${err.message}</p></div>`,
          `Frame ${frame.fileName} in survey ${survey.name} failed processing: ${err.message}`,
          { frameId, surveyId: String(survey._id), severity: 'HIGH' },
        )
        .catch((mailErr) => this.logger.warn(`Processing-failure alert dispatch failed: ${mailErr.message}`));

      if (updatedSurvey) await this.maybeCompleteSurvey(updatedSurvey);

      throw err;
    }
  }

  /**
   * A survey transitions PROCESSING -> COMPLETED once every uploaded frame
   * has either finished or failed. Fires the SURVEY_COMPLETED alert exactly
   * once (guarded by the status check) rather than on every frame.
   */
  private async maybeCompleteSurvey(survey: any) {
    if (!survey || survey.status !== 'PROCESSING') return;
    const accountedFor = survey.processedFrames + survey.failedFrames;
    if (survey.totalFrames > 0 && accountedFor >= survey.totalFrames) {
      const completed = await this.surveysService.update(String(survey._id), {
        status: 'COMPLETED' as any,
        completedAt: new Date(),
      } as any);

      this.realtime.emitEvent('survey_updated', { surveyId: survey._id, status: 'COMPLETED' });

      this.mailEvents
        .dispatch(
          'SURVEY_COMPLETED',
          `Survey completed - ${survey.name} (${survey.code})`,
          `<div style="font-family:sans-serif"><p>Survey <b>${survey.name}</b> (${survey.code}) has finished processing: ${survey.processedFrames} processed, ${survey.failedFrames} failed of ${survey.totalFrames} total frames.</p></div>`,
          `Survey ${survey.name} (${survey.code}) completed: ${survey.processedFrames}/${survey.totalFrames} processed, ${survey.failedFrames} failed.`,
          { surveyId: String(survey._id), severity: 'INFO' },
        )
        .catch((err) => this.logger.warn(`Survey-completed alert dispatch failed: ${err.message}`));

      return completed;
    }
  }
}
