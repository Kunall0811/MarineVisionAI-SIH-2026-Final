import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FridayApi } from '../api/services';
import type { FridayCommandResult } from '../types';

export async function speak(text: string) {
  try {
    const audioBlob = await FridayApi.textToSpeech(text);
    const url = URL.createObjectURL(audioBlob);
    const audio = new Audio(url);
    audio.volume = 0.9;
    audio.onended = () => URL.revokeObjectURL(url);
    await audio.play();
    return;
  } catch (err) {
    // Keep FRIDAY usable when ElevenLabs is not configured or temporarily unavailable.
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find((v) =>
      /female|samantha|zira|google us english|aria|jenny/i.test(v.name),
    );
    if (femaleVoice) utterance.voice = femaleVoice;
    utterance.rate = 1.02;
    utterance.pitch = 1.04;
    window.speechSynthesis.speak(utterance);
  }
}

export interface FridayState {
  listening: boolean;
  processing: boolean;
  transcript: string;
  lastResult: FridayCommandResult | null;
  error: string;
  micSupported: boolean;
  voiceProvider: 'ElevenLabs' | 'Browser fallback';
}

function getRecorderMimeType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

export function useFriday() {
  const navigate = useNavigate();
  const [state, setState] = useState<FridayState>({
    listening: false,
    processing: false,
    transcript: '',
    lastResult: null,
    error: '',
    micSupported: typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
    voiceProvider: 'Browser fallback',
  });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const handleActionData = useCallback(
    (data?: Record<string, any>) => {
      if (!data) return;
      switch (data.action) {
        case 'FRIDAY_ON':
          // Frontend handles toggling via state - just navigate to friday page for feedback
          break;
        case 'FRIDAY_OFF':
          // Frontend state toggle handles this
          break;
        case 'NAVIGATE':
          if (data.route) navigate(data.route);
          break;
        case 'OPEN_DETECTION':
          navigate(`/map?anomalyId=${data.detectionId}`);
          break;
        case 'ZOOM_GLOBE':
          navigate(data.target && typeof data.target !== 'string' ? `/globe?anomalyId=${data.target.anomalyCode}` : '/globe');
          break;
        case 'OPEN_REPORT':
          navigate('/reports');
          break;
        case 'START_PROCESSING':
          navigate('/surveys');
          break;
        default:
          break;
      }
    },
    [navigate],
  );

  const applyResult = useCallback(async (result: FridayCommandResult) => {
    setState((s) => ({ ...s, processing: false, lastResult: result, transcript: result.data?.transcript || s.transcript }));
    if (result.spokenResponse) await speak(result.spokenResponse);
    if (!result.requiresConfirmation) handleActionData(result.data);
    return result;
  }, [handleActionData]);

  const sendCommand = useCallback(
    async (transcript: string, confirm?: boolean, interactionId?: string) => {
      setState((s) => ({ ...s, processing: true, error: '', transcript }));
      try {
        const result: FridayCommandResult = await FridayApi.command(transcript, confirm, interactionId);
        return await applyResult(result);
      } catch (err: any) {
        const message = err?.response?.data?.error?.message || 'FRIDAY could not process that command.';
        setState((s) => ({ ...s, processing: false, error: message }));
        await speak(message);
        return null;
      }
    },
    [applyResult],
  );

  const sendVoiceCommand = useCallback(async (audio: Blob) => {
    setState((s) => ({ ...s, processing: true, listening: false, error: '' }));
    try {
      const result: FridayCommandResult = await FridayApi.voiceCommand(audio);
      setState((s) => ({ ...s, voiceProvider: 'ElevenLabs' }));
      return await applyResult(result);
    } catch (err: any) {
      const message = err?.response?.data?.error?.message || 'FRIDAY could not understand the voice command.';
      setState((s) => ({ ...s, processing: false, error: message }));
      await speak(message);
      return null;
    }
  }, [applyResult]);

  const startListening = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setState((s) => ({ ...s, error: 'Microphone recording is not supported in this browser.' }));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = getRecorderMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        if (blob.size > 1000) await sendVoiceCommand(blob);
        else setState((s) => ({ ...s, error: 'No usable audio was captured. Try again.' }));
      };
      recorder.start();
      setState((s) => ({ ...s, listening: true, error: '' }));
    } catch {
      setState((s) => ({ ...s, error: 'Microphone permission was denied or unavailable.' }));
    }
  }, [sendVoiceCommand]);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    setState((s) => ({ ...s, listening: false }));
  }, []);

  const confirmPending = useCallback(() => {
    if (state.lastResult?.interactionId) {
      sendCommand(state.transcript, true, state.lastResult.interactionId);
    }
  }, [sendCommand, state.lastResult, state.transcript]);

  const sendTyped = useCallback((text: string) => {
    setState((s) => ({ ...s, transcript: text }));
    sendCommand(text);
  }, [sendCommand]);

  return { ...state, startListening, stopListening, sendTyped, confirmPending };
}
