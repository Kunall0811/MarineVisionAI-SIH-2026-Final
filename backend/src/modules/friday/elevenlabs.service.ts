import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Server-side ElevenLabs gateway.
 * The API key never reaches the browser. FRIDAY can therefore support:
 * audio -> ElevenLabs Scribe STT -> command execution -> ElevenLabs TTS.
 */
@Injectable()
export class ElevenLabsService {
  constructor(private readonly config: ConfigService) {}

  private get apiKey(): string {
    return this.config.get<string>('elevenlabs.apiKey') || '';
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async transcribe(audio: Buffer, mimeType = 'audio/webm') {
    if (!this.apiKey) {
      throw new ServiceUnavailableException({
        success: false,
        error: {
          code: 'ELEVENLABS_NOT_CONFIGURED',
          message: 'ElevenLabs is not configured. Set ELEVENLABS_API_KEY on the backend.',
        },
      });
    }

    const form = new FormData();
    form.append('model_id', this.config.get<string>('elevenlabs.sttModel') || 'scribe_v2');
    form.append('file', new Blob([new Uint8Array(audio)], { type: mimeType }), 'friday-audio.webm');

    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': this.apiKey },
      body: form,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new ServiceUnavailableException({
        success: false,
        error: {
          code: 'ELEVENLABS_STT_FAILED',
          message: `ElevenLabs speech recognition failed (${response.status}).`,
          detail: detail.slice(0, 500),
        },
      });
    }

    const data: any = await response.json();
    return {
      text: String(data.text || '').trim(),
      languageCode: data.language_code || null,
      languageProbability: data.language_probability ?? null,
    };
  }

  async synthesize(text: string): Promise<Buffer> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException({
        success: false,
        error: {
          code: 'ELEVENLABS_NOT_CONFIGURED',
          message: 'ElevenLabs is not configured. Set ELEVENLABS_API_KEY on the backend.',
        },
      });
    }

    const voiceId = this.config.get<string>('elevenlabs.voiceId') || '21m00Tcm4TlvDq8ikWAM';
    const modelId = this.config.get<string>('elevenlabs.ttsModel') || 'eleven_multilingual_v2';

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text.slice(0, 5000),
          model_id: modelId,
          voice_settings: {
            stability: 0.62,
            similarity_boost: 0.82,
            style: 0.18,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new ServiceUnavailableException({
        success: false,
        error: {
          code: 'ELEVENLABS_TTS_FAILED',
          message: `ElevenLabs voice synthesis failed (${response.status}).`,
          detail: detail.slice(0, 500),
        },
      });
    }

    return Buffer.from(await response.arrayBuffer());
  }
}
