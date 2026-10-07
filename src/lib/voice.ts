// Voice notes for the reflection chat: capture with MediaRecorder, then
// transcribe server-side via POST /api/v1/ai/transcribe (multipart audio).
// Routing (en/pcm → Whisper chain, yo/ha/ig → N-ATLaS sidecar) is the
// backend's call; it uses the student's preferredLanguage by default.

import { apiFetch } from './api'

export interface VoiceClip {
  blob: Blob
  filename: string
  durationSeconds: number
}

interface VoiceTranscript {
  text: string
  durationSeconds?: number
}

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/ogg',
] as const

const EXTENSIONS: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
}

export function isVoiceSupported(): boolean {
  return (
    window.isSecureContext &&
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function'
  )
}

function pickMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  return MIME_CANDIDATES.find((mime) => MediaRecorder.isTypeSupported(mime))
}

/**
 * One recording session. `start()` acquires the mic and begins capturing;
 * `stop()` resolves with the clip (or null when cancelled or empty);
 * `cancel()` abandons it. Either way the mic tracks are released.
 */
export class VoiceRecorder {
  private readonly recorder: MediaRecorder
  private readonly stream: MediaStream
  private readonly chunks: BlobPart[] = []
  private readonly startedAt = performance.now()
  private cancelled = false
  private readonly finished: Promise<VoiceClip | null>

  private constructor(stream: MediaStream, mimeType: string | undefined) {
    this.stream = stream
    this.recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    this.finished = new Promise((resolve) => {
      this.recorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.chunks.push(event.data)
      }
      this.recorder.onstop = () => {
        this.stream.getTracks().forEach((track) => track.stop())
        if (this.cancelled || this.chunks.length === 0) {
          resolve(null)
          return
        }
        // The backend allowlist expects bare mime types (no ";codecs=...").
        const mimeType = (this.recorder.mimeType || 'audio/webm')
          .split(';')[0]
          .trim()
          .toLowerCase()
        const extension = EXTENSIONS[mimeType] ?? 'webm'
        resolve({
          blob: new Blob(this.chunks, { type: mimeType }),
          filename: `voice-note.${extension}`,
          durationSeconds: this.elapsedSeconds(),
        })
      }
    })
  }

  static async start(): Promise<VoiceRecorder> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const recorder = new VoiceRecorder(stream, pickMime())
    recorder.recorder.start(250)
    return recorder
  }

  elapsedSeconds(): number {
    return (performance.now() - this.startedAt) / 1000
  }

  stop(): Promise<VoiceClip | null> {
    if (this.recorder.state !== 'inactive') this.recorder.stop()
    return this.finished
  }

  cancel(): void {
    this.cancelled = true
    if (this.recorder.state !== 'inactive') this.recorder.stop()
  }
}

export function transcribeVoice(clip: VoiceClip): Promise<VoiceTranscript> {
  const form = new FormData()
  form.append('audio', clip.blob, clip.filename)
  return apiFetch<VoiceTranscript>('/api/v1/ai/transcribe', { method: 'POST', body: form })
}
