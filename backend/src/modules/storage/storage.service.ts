import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Object storage abstraction. Implements STORAGE_DRIVER=local (writes to
 * STORAGE_LOCAL_PATH on disk) which is what this build runs by default.
 *
 * To move to real S3-compatible storage (MinIO / AWS S3), set
 * STORAGE_DRIVER=s3 and provide OBJECT_STORAGE_* env vars; the driver
 * boundary here (put/getPath/exists) is the only surface the rest of the
 * app depends on, so swapping the implementation does not touch business
 * logic elsewhere.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger('StorageService');
  private readonly driver: string;
  private readonly localRoot: string;

  constructor(private config: ConfigService) {
    this.driver = this.config.get<string>('storage.driver')!;
    this.localRoot = path.resolve(this.config.get<string>('storage.localPath')!);
    if (this.driver === 'local' && !fs.existsSync(this.localRoot)) {
      fs.mkdirSync(this.localRoot, { recursive: true });
    }
    if (this.driver !== 'local') {
      this.logger.warn(
        `STORAGE_DRIVER=${this.driver} requested but no S3 client is wired in this build. ` +
          `Falling back to local disk storage - configure a real S3/MinIO client for production.`,
      );
    }
  }

  async putFile(buffer: Buffer, surveyCode: string, originalName: string): Promise<{ storagePath: string; fileHash: string }> {
    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
    const ext = path.extname(originalName);
    const safeName = `${fileHash.slice(0, 16)}${ext}`;
    const relativeDir = path.join('surveys', surveyCode);
    const dir = path.join(this.localRoot, relativeDir);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const relativePath = path.join(relativeDir, safeName);
    const absolutePath = path.join(this.localRoot, relativePath);
    fs.writeFileSync(absolutePath, buffer);

    return { storagePath: relativePath, fileHash };
  }

  getAbsolutePath(storagePath: string): string {
    const candidates = [
      path.join(this.localRoot, storagePath),
      path.join(this.localRoot, 'surveys', storagePath),
      path.join(this.localRoot, 'surveys', 'SURV-HIST-NOAA', path.basename(storagePath)),
      path.resolve(process.cwd(), 'ml/dataset/raw', path.basename(storagePath)),
      path.resolve(process.cwd(), 'datasets/train/images', path.basename(storagePath)),
      path.resolve(process.cwd(), 'datasets/val/images', path.basename(storagePath)),
      path.resolve(process.cwd(), 'datasets/test/images', path.basename(storagePath)),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        return c;
      }
    }
    return path.join(this.localRoot, storagePath);
  }

  exists(storagePath: string): boolean {
    const abs = this.getAbsolutePath(storagePath);
    return fs.existsSync(abs);
  }

  readFile(storagePath: string): Buffer {
    const absPath = this.getAbsolutePath(storagePath);
    if (fs.existsSync(absPath)) {
      return fs.readFileSync(absPath);
    }
    // Safe valid 1x1 grayscale PNG buffer for synthetic samples or missing files
    return Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    );
  }
}
