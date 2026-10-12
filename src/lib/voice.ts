// Voice notes for the reflection chat: capture PCM with the Web Audio API,
// encode a 16kHz mono WAV in the browser, then transcribe server-side via
// POST /api/v1/ai/transcribe (multipart audio).
//
// WAV rather than MediaRecorder's webm/opus: the vernacular ASR endpoints
// (NCAIR1 whisper fine-tunes on HF Inference Endpoints) decode through
// libsndfile, which cannot read the webm container, and Safari/iOS cannot
// record webm at all. PCM capture works in every browser, and the Whisper
// lane reads WAV too.
// Routing (en/pcm → Whisper chain, yo/ha/ig → N-ATLaS) is the backend's call;
// it uses the student's preferredLanguage by default.

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

/** Whisper resamples internally to 16kHz, so recording at that rate keeps the
 * upload small without costing accuracy. */
const TARGET_SAMPLE_RATE = 16_000
const WORKLET_PROCESSOR = 'soul-nurture-recorder'

/** Runs on the audio thread: accumulates mic quanta and posts a Float32Array
 * every ~50ms (small enough that stopping loses no audible tail, large
 * enough to keep message traffic trivial). */
const WORKLET_SOURCE = `
class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.pending = [];
    this.frames = 0;
    this.flushAt = Math.round(sampleRate * 0.05);
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;
    this.pending.push(new Float32Array(channel));
    this.frames += channel.length;
    if (this.frames >= this.flushAt) {
      const block = new Float32Array(this.frames);
      let offset = 0;
      for (const chunk of this.pending) { block.set(chunk, offset); offset += chunk.length; }
      this.port.postMessage(block, [block.buffer]);
      this.pending = [];
      this.frames = 0;
    }
    return true;
  }
}
registerProcessor('${WORKLET_PROCESSOR}', RecorderProcessor);
`

export function isVoiceSupported(): boolean {
  return (
    window.isSecureContext &&
    typeof AudioContext !== 'undefined' &&
    typeof AudioWorkletNode !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function'
  )
}

function concatenate(chunks: Float32Array[]): Float32Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const pcm = new Float32Array(total)
  let offset = 0
  for (const chunk of chunks) {
    pcm.set(chunk, offset)
    offset += chunk.length
  }
  return pcm
}

/** Box-average resample: averages each output sample over the input samples it
 * covers, which is enough low-pass filtering for speech at 48k → 16k. */
function resample(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return input
  const ratio = from / to
  const length = Math.floor(input.length / ratio)
  const output = new Float32Array(length)
  for (let i = 0; i < length; i += 1) {
    const start = Math.floor(i * ratio)
    const end = Math.min(input.length, Math.ceil((i + 1) * ratio))
    let sum = 0
    for (let j = start; j < end; j += 1) sum += input[j]
    output[i] = sum / Math.max(1, end - start)
  }
  return output
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const writeLabel = (offset: number, label: string) => {
    for (let i = 0; i < label.length; i += 1) view.setUint8(offset + i, label.charCodeAt(i))
  }

  writeLabel(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeLabel(8, 'WAVE')
  writeLabel(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate: mono 16-bit
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  writeLabel(36, 'data')
  view.setUint32(40, samples.length * 2, true)

  let offset = 44
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
    offset += 2
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

/**
 * One recording session. `start()` acquires the mic and begins capturing;
 * `stop()` resolves with the WAV clip (or null when cancelled or empty);
 * `cancel()` abandons it. Either way the mic tracks and the audio context are
 * released exactly once.
 */
export class VoiceRecorder {
  private readonly stream: MediaStream
  private readonly context: AudioContext
  private readonly node: AudioWorkletNode
  private readonly chunks: Float32Array[] = []
  private readonly sourceRate: number
  private readonly startedAt = performance.now()
  private readonly finished: Promise<VoiceClip | null>
  private resolveFinished!: (clip: VoiceClip | null) => void
  private tornDown = false

  private constructor(context: AudioContext, node: AudioWorkletNode, stream: MediaStream) {
    this.context = context
    this.node = node
    this.stream = stream
    this.sourceRate = context.sampleRate
    this.finished = new Promise((resolve) => {
      this.resolveFinished = resolve
    })
    this.node.port.onmessage = (event: MessageEvent<Float32Array>) => {
      this.chunks.push(event.data)
    }
  }

  static async start(): Promise<VoiceRecorder> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const context = new AudioContext()
    if (context.state === 'suspended') await context.resume()
    const moduleUrl = URL.createObjectURL(
      new Blob([WORKLET_SOURCE], { type: 'application/javascript' }),
    )
    try {
      await context.audioWorklet.addModule(moduleUrl)
    } finally {
      URL.revokeObjectURL(moduleUrl)
    }
    const node = new AudioWorkletNode(context, WORKLET_PROCESSOR)
    // Never routed to context.destination — monitoring the mic would feed back
    // into the recording.
    context.createMediaStreamSource(stream).connect(node)
    return new VoiceRecorder(context, node, stream)
  }

  elapsedSeconds(): number {
    return (performance.now() - this.startedAt) / 1000
  }

  stop(): Promise<VoiceClip | null> {
    this.tearDown(false)
    return this.finished
  }

  cancel(): void {
    this.tearDown(true)
  }

  private tearDown(cancelled: boolean): void {
    if (this.tornDown) return
    this.tornDown = true
    this.node.port.onmessage = null
    this.node.disconnect()
    this.stream.getTracks().forEach((track) => track.stop())
    void this.context.close()

    if (cancelled || this.chunks.length === 0) {
      this.resolveFinished(null)
      return
    }
    const samples = resample(
      concatenate(this.chunks),
      this.sourceRate,
      TARGET_SAMPLE_RATE,
    )
    this.resolveFinished({
      blob: encodeWav(samples, TARGET_SAMPLE_RATE),
      filename: 'voice-note.wav',
      durationSeconds: this.elapsedSeconds(),
    })
  }
}

export function transcribeVoice(clip: VoiceClip): Promise<VoiceTranscript> {
  const form = new FormData()
  form.append('audio', clip.blob, clip.filename)
  return apiFetch<VoiceTranscript>('/api/v1/ai/transcribe', { method: 'POST', body: form })
}
