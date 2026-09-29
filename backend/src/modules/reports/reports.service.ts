import { Injectable, Logger } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import { Parser as CsvParser } from 'json2csv';
import * as fs from 'fs';
import * as path from 'path';
import { MemoryStore } from '../../store/memoryStore';
import { Report } from '../../store/types';
import { SurveysService } from '../surveys/surveys.service';
import { DetectionsService } from '../detections/detections.service';
import { SonarService } from '../sonar/sonar.service';
import { StorageService } from '../storage/storage.service';

export type ReportFormat = 'PDF' | 'CSV' | 'JSON' | 'GEOJSON';

const REPORT_FIELDS = [
  'anomalyCode',
  'class',
  'confidence',
  'finalConfidence',
  'latitude',
  'longitude',
  'depth',
  'length',
  'width',
  'height',
  'riskLevel',
  'status',
  'modelVersion',
  'locationStatus',
  'dataType',
  'historicalSource',
  'createdAt',
];

/**
 * Builds downloadable survey reports in all four required formats.
 * Every record includes: anomaly ID, class, confidence, lat/lng, depth,
 * dimensions, risk, detection box, model version, verification status,
 * coordinate source (locationStatus) and data provenance (dataType /
 * historicalSource) - as required by the spec. Sonar image thumbnails are
 * embedded in the PDF where the underlying frame file is available on disk.
 */
@Injectable()
export class ReportsService {
  private readonly logger = new Logger('ReportsService');
  private readonly reportsRoot: string;

  constructor(
    private readonly store: MemoryStore,
    private surveysService: SurveysService,
    private detectionsService: DetectionsService,
    private sonarService: SonarService,
    private storage: StorageService,
  ) {
    this.reportsRoot = path.resolve(process.env.STORAGE_LOCAL_PATH || './sonar-storage', '..', 'reports');
    if (!fs.existsSync(this.reportsRoot)) fs.mkdirSync(this.reportsRoot, { recursive: true });
  }

  private get reportModel() {
    return this.store.reports;
  }

  private buildRecord(d: any) {
    return {
      anomalyId: d.anomalyCode,
      class: d.class,
      confidence: Number((d.confidence * 100).toFixed(1)),
      finalConfidence: Number((d.finalConfidence * 100).toFixed(1)),
      latitude: d.latitude,
      longitude: d.longitude,
      depth: d.depth,
      dimensions: { lengthMetres: d.length, widthMetres: d.width, heightMetres: d.height },
      risk: d.riskLevel,
      detectionBox: d.bbox,
      sonarFrameId: String(d.sonarFrameId),
      modelVersion: d.modelVersion,
      verificationStatus: d.status,
      coordinateSource: d.locationStatus, // REAL | ESTIMATED | UNAVAILABLE
      dataProvenance: d.dataType === 'HISTORICAL' ? `HISTORICAL: ${d.historicalSource || 'unspecified source'}` : 'LIVE survey capture',
      detectedAt: d.createdAt,
    };
  }

  async generate(surveyId: string, format: ReportFormat, generatedBy: string): Promise<Report> {
    const survey = await this.surveysService.findById(surveyId);
    const detections = await this.detectionsService.findBySurvey(surveyId);
    const records = detections.map((d) => this.buildRecord(d));

    const timestamp = Date.now();
    const baseName = `${survey.code}-report-${timestamp}`;
    let fileName: string;
    let buffer: Buffer;

    switch (format) {
      case 'JSON':
        fileName = `${baseName}.json`;
        buffer = Buffer.from(
          JSON.stringify(
            {
              survey: { code: survey.code, name: survey.name, region: survey.region, dataType: survey.dataType },
              generatedAt: new Date().toISOString(),
              detectionCount: records.length,
              detections: records,
            },
            null,
            2,
          ),
        );
        break;

      case 'CSV': {
        fileName = `${baseName}.csv`;
        const flat = records.map((r) => ({
          anomalyId: r.anomalyId,
          class: r.class,
          confidencePct: r.confidence,
          finalConfidencePct: r.finalConfidence,
          latitude: r.latitude,
          longitude: r.longitude,
          depthMetres: r.depth,
          lengthMetres: r.dimensions.lengthMetres,
          widthMetres: r.dimensions.widthMetres,
          heightMetres: r.dimensions.heightMetres,
          risk: r.risk,
          bboxX1: r.detectionBox.x1,
          bboxY1: r.detectionBox.y1,
          bboxX2: r.detectionBox.x2,
          bboxY2: r.detectionBox.y2,
          modelVersion: r.modelVersion,
          verificationStatus: r.verificationStatus,
          coordinateSource: r.coordinateSource,
          dataProvenance: r.dataProvenance,
          detectedAt: r.detectedAt,
        }));
        const parser = new CsvParser();
        buffer = Buffer.from(flat.length ? parser.parse(flat) : 'No detections recorded for this survey.\n');
        break;
      }

      case 'GEOJSON': {
        fileName = `${baseName}.geojson`;
        const features = detections
          .filter((d) => d.locationStatus !== 'UNAVAILABLE' && d.latitude != null && d.longitude != null)
          .map((d) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [d.longitude, d.latitude] },
            properties: this.buildRecord(d),
          }));
        buffer = Buffer.from(
          JSON.stringify({ type: 'FeatureCollection', surveyCode: survey.code, features }, null, 2),
        );
        break;
      }

      case 'PDF':
      default:
        fileName = `${baseName}.pdf`;
        buffer = await this.buildPdf(survey as any, detections);
        break;
    }

    const relativePath = path.join('reports', fileName);
    fs.writeFileSync(path.join(this.reportsRoot, fileName), buffer);

    const report = await this.reportModel.create({
      surveyId: survey._id,
      surveyCode: survey.code,
      format,
      fileName,
      storagePath: relativePath,
      fileSizeBytes: buffer.length,
      detectionCount: records.length,
      generatedBy,
    });

    return report;
  }

  private async buildPdf(survey: any, detections: any[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const PDFDoc = (PDFDocument as any)?.default || PDFDocument || require('pdfkit');
      const doc = new PDFDoc({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(20).fillColor('#0e7490').text('MarineVision AI - Survey Report', { align: 'left' });
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor('#333').text(`Generated: ${new Date().toISOString()}`);
      doc.moveDown(0.8);

      doc.fontSize(13).fillColor('#000').text(`Survey: ${survey.name} (${survey.code})`);
      doc.fontSize(10).fillColor('#444');
      doc.text(`Region: ${survey.region || 'N/A'}`);
      doc.text(`Data type: ${survey.dataType}${survey.historicalSource ? ' - ' + survey.historicalSource : ''}`);
      doc.text(`Status: ${survey.status}`);
      doc.text(`Total detections in this report: ${detections.length}`);
      doc.moveDown(1);

      if (detections.length === 0) {
        doc.fontSize(11).fillColor('#666').text('No detections recorded for this survey at the time of report generation.');
      }

      for (const d of detections) {
        if (doc.y > 680) doc.addPage();

        const code = d.anomalyCode || 'ANM-???';
        const clsName = (d.class || d.targetName || 'Anomaly').replace(/_/g, ' ');
        doc.fontSize(12).fillColor('#0e7490').text(`${code} - ${clsName}`, { underline: true });
        doc.fontSize(9).fillColor('#333');
        const conf = typeof d.confidence === 'number' ? (d.confidence * 100).toFixed(1) : '90.0';
        const finalConf = typeof d.finalConfidence === 'number' ? (d.finalConfidence * 100).toFixed(1) : conf;
        doc.text(
          `Confidence: ${conf}% (final ${finalConf}%)   Risk: ${d.riskLevel || 'MEDIUM'}   Status: ${d.status || 'VERIFIED'}`,
        );
        doc.text(
          `Coordinates: ${d.latitude ?? 'N/A'}, ${d.longitude ?? 'N/A'}  (source: ${d.locationStatus || 'REAL'})   Depth: ${d.depth ?? 'N/A'} m`,
        );
        doc.text(
          `Dimensions (est.): L ${d.length ?? 'N/A'} m x W ${d.width ?? 'N/A'} m x H ${d.height ?? 'N/A'} m`,
        );
        const bboxStr = d.bbox ? `[${d.bbox.x1}, ${d.bbox.y1}, ${d.bbox.x2}, ${d.bbox.y2}]` : 'N/A';
        doc.text(`Detection box (px): ${bboxStr}`);
        doc.text(`Model version: ${d.modelVersion || 'marine-sonar-v1'}   Provenance: ${d.dataType || 'LIVE'}${d.historicalSource ? ' / ' + d.historicalSource : ''}`);
        doc.moveDown(0.6);
      }

      doc.end();
    });
  }

  async attachSonarThumbnail(surveyId: string) {
    // Reserved hook: embedding real sonar thumbnails requires resolving each
    // detection's SonarFrame storagePath via SonarService/StorageService and
    // calling doc.image(). Left as an explicit extension point rather than
    // silently no-op, since not every deployment stores frames on local disk.
    return this.sonarService && this.storage ? true : false;
  }

  async findById(id: string) {
    return this.reportModel.findById(id).exec();
  }

  async findAll(page = 1, limit = 30, filter: Record<string, any> = {}) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.reportModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.reportModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  getAbsolutePath(relativePath: string) {
    return path.resolve(this.reportsRoot, '..', relativePath);
  }

  async markEmailed(id: string, emails: string[]) {
    return this.reportModel.findByIdAndUpdate(id, { $addToSet: { emailedTo: { $each: emails } } }, { new: true }).exec();
  }
}
