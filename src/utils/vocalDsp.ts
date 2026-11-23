export interface VocalDspSettings {
  echoLevel: number; // 0..100 (%)
  echoDelayMs: number; // 80..420 (ms)
  reverbLevel: number; // 0..100 (%)
  micGain: number; // 40..160 (%)
  vocalTone: number; // -6..6 (dB high-shelf brightness)
}

export type VocalDspPresetId = 'karaoke' | 'ballad' | 'stage' | 'dry' | 'custom';

export interface VocalDspPreset {
  id: Exclude<VocalDspPresetId, 'custom'>;
  label: string;
  description: string;
  settings: VocalDspSettings;
}

export const DEFAULT_VOCAL_DSP_SETTINGS: VocalDspSettings = {
  echoLevel: 38,
  echoDelayMs: 210,
  reverbLevel: 32,
  micGain: 115,
  vocalTone: 2,
};

export const VOCAL_DSP_PRESETS: VocalDspPreset[] = [
  {
    id: 'karaoke',
    label: 'Chuẩn Karaoke',
    description: 'Echo vừa phải kết hợp Reverb nhẹ giúp hát nhẹ hơi',
    settings: {
      echoLevel: 38,
      echoDelayMs: 210,
      reverbLevel: 32,
      micGain: 115,
      vocalTone: 2,
    },
  },
  {
    id: 'ballad',
    label: 'Phòng Trà',
    description: 'Reverb ấm áp cho Bolero & Nhạc Trữ Tình',
    settings: {
      echoLevel: 26,
      echoDelayMs: 185,
      reverbLevel: 54,
      micGain: 115,
      vocalTone: 1,
    },
  },
  {
    id: 'stage',
    label: 'Sân Khấu',
    description: 'Vang dày và sáng giọng cho Remix & Nhạc Trẻ',
    settings: {
      echoLevel: 52,
      echoDelayMs: 255,
      reverbLevel: 66,
      micGain: 120,
      vocalTone: 3,
    },
  },
  {
    id: 'dry',
    label: 'Giọng Mộc',
    description: 'Tắt Echo & Reverb, giữ nguyên tiếng mic sạch',
    settings: {
      echoLevel: 0,
      echoDelayMs: 180,
      reverbLevel: 0,
      micGain: 105,
      vocalTone: 0,
    },
  },
];

const DSP_STORAGE_KEY = 'karaoke_vocal_dsp_v1';

export function loadSavedVocalDspSettings(): VocalDspSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_VOCAL_DSP_SETTINGS };
  try {
    const raw = window.localStorage.getItem(DSP_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_VOCAL_DSP_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<VocalDspSettings>;
    return {
      echoLevel: clampNumber(parsed.echoLevel, 0, 100, DEFAULT_VOCAL_DSP_SETTINGS.echoLevel),
      echoDelayMs: clampNumber(parsed.echoDelayMs, 80, 420, DEFAULT_VOCAL_DSP_SETTINGS.echoDelayMs),
      reverbLevel: clampNumber(parsed.reverbLevel, 0, 100, DEFAULT_VOCAL_DSP_SETTINGS.reverbLevel),
      micGain: clampNumber(parsed.micGain, 40, 160, DEFAULT_VOCAL_DSP_SETTINGS.micGain),
      vocalTone: clampNumber(parsed.vocalTone, -6, 6, DEFAULT_VOCAL_DSP_SETTINGS.vocalTone),
    };
  } catch {
    return { ...DEFAULT_VOCAL_DSP_SETTINGS };
  }
}

export function saveVocalDspSettings(settings: VocalDspSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DSP_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}

export function detectVocalDspPreset(settings: VocalDspSettings): VocalDspPresetId {
  for (const preset of VOCAL_DSP_PRESETS) {
    const p = preset.settings;
    if (
      p.echoLevel === settings.echoLevel &&
      p.echoDelayMs === settings.echoDelayMs &&
      p.reverbLevel === settings.reverbLevel &&
      p.micGain === settings.micGain &&
      p.vocalTone === settings.vocalTone
    ) {
      return preset.id;
    }
  }
  return 'custom';
}

function clampNumber(val: unknown, min: number, max: number, fallback: number): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.max(min, Math.min(max, Math.round(val)));
}

/**
 * Generates a warm algorithmic stereo room/hall impulse response for Web Audio ConvolverNode.
 * Uses exponentially decaying filtered stereo noise so no external IR file fetch is needed.
 */
export function createReverbImpulseResponse(
  ctx: AudioContext,
  durationSeconds = 2.1,
  decay = 2.8
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * durationSeconds));
  const impulse = ctx.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    let lpState = 0;
    for (let i = 0; i < length; i++) {
      const progress = i / length;
      const envelope = Math.pow(1 - progress, decay);
      // Slight early-reflection shimmer in the first 40ms
      const earlyBoost = i < sampleRate * 0.04 ? 1.15 : 1.0;
      const white = Math.random() * 2 - 1;
      // Gentle damping filter to avoid harsh metallic high frequencies
      lpState = lpState * 0.45 + white * 0.55;
      data[i] = lpState * envelope * earlyBoost * 0.65;
    }
  }

  return impulse;
}

export interface VocalDspGraphHandle {
  outputNode: GainNode;
  analyser: AnalyserNode;
  updateSettings: (next: VocalDspSettings) => void;
  setOutputMuted: (muted: boolean) => void;
  destroy: () => void;
}

/**
 * Builds a complete Karaoke Vocal DSP pipeline:
 * Source -> Highpass (85Hz) -> HighShelf Tone EQ -> Mic Gain ->
 *   [Dry Path] + [Echo Delay + Lowpass + Feedback] + [PreDelay + Convolver Reverb + Damping]
 * -> Master Bus -> DynamicsCompressor -> Output Gain -> Optional Destination
 */
export function createVocalDspGraph(
  ctx: AudioContext,
  sourceNode: AudioNode,
  initialSettings: VocalDspSettings,
  destinationNode?: AudioNode | null
): VocalDspGraphHandle {
  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 85;
  highpass.Q.value = 0.7;

  const toneShelf = ctx.createBiquadFilter();
  toneShelf.type = 'highshelf';
  toneShelf.frequency.value = 3200;

  const micGain = ctx.createGain();
  const dryGain = ctx.createGain();
  dryGain.gain.value = 1.0;

  // Echo branch (Delay -> Lowpass -> Feedback loop + Wet Gain)
  const echoDelay = ctx.createDelay(1.0);
  const echoLowpass = ctx.createBiquadFilter();
  echoLowpass.type = 'lowpass';
  echoLowpass.frequency.value = 2600;
  const echoFeedback = ctx.createGain();
  const echoWetGain = ctx.createGain();

  // Reverb branch (Pre-delay -> Convolver -> Damping Lowpass -> Wet Gain)
  const reverbPreDelay = ctx.createDelay(0.2);
  reverbPreDelay.delayTime.value = 0.022;
  const reverbConvolver = ctx.createConvolver();
  reverbConvolver.buffer = createReverbImpulseResponse(ctx, 2.1, 2.8);
  const reverbDamp = ctx.createBiquadFilter();
  reverbDamp.type = 'lowpass';
  reverbDamp.frequency.value = 4600;
  const reverbWetGain = ctx.createGain();

  // Master bus + gentle compressor to protect against vocal clipping
  const masterBus = ctx.createGain();
  masterBus.gain.value = 1.0;

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -14;
  compressor.knee.value = 18;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.16;

  const outputNode = ctx.createGain();
  outputNode.gain.value = 1.0;

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;

  // Wire graph
  sourceNode.connect(highpass);
  highpass.connect(toneShelf);
  toneShelf.connect(micGain);

  // VU meter measures pre-output vocal gain
  micGain.connect(analyser);

  // Dry
  micGain.connect(dryGain);
  dryGain.connect(masterBus);

  // Echo
  micGain.connect(echoDelay);
  echoDelay.connect(echoLowpass);
  echoLowpass.connect(echoFeedback);
  echoFeedback.connect(echoDelay);
  echoLowpass.connect(echoWetGain);
  echoWetGain.connect(masterBus);

  // Reverb
  micGain.connect(reverbPreDelay);
  reverbPreDelay.connect(reverbConvolver);
  reverbConvolver.connect(reverbDamp);
  reverbDamp.connect(reverbWetGain);
  reverbWetGain.connect(masterBus);

  // Master -> Compressor -> Output
  masterBus.connect(compressor);
  compressor.connect(outputNode);

  if (destinationNode) {
    outputNode.connect(destinationNode);
  }

  const applySettings = (next: VocalDspSettings) => {
    const now = ctx.currentTime;
    const echoRatio = clampNumber(next.echoLevel, 0, 100, 38) / 100;
    const delaySec = clampNumber(next.echoDelayMs, 80, 420, 210) / 1000;
    const reverbRatio = clampNumber(next.reverbLevel, 0, 100, 32) / 100;
    const gainRatio = clampNumber(next.micGain, 40, 160, 115) / 100;
    const toneDb = Math.max(-6, Math.min(6, next.vocalTone));

    micGain.gain.setTargetAtTime(gainRatio, now, 0.02);
    toneShelf.gain.setTargetAtTime(toneDb, now, 0.02);

    echoDelay.delayTime.setTargetAtTime(delaySec, now, 0.025);
    // Feedback capped at 0.48 so Echo trails warmly without infinite self-oscillation
    echoFeedback.gain.setTargetAtTime(Math.min(0.48, echoRatio * 0.52), now, 0.02);
    echoWetGain.gain.setTargetAtTime(echoRatio * 0.78, now, 0.02);

    reverbWetGain.gain.setTargetAtTime(reverbRatio * 0.92, now, 0.02);
  };

  applySettings(initialSettings);

  return {
    outputNode,
    analyser,
    updateSettings: applySettings,
    setOutputMuted: (muted: boolean) => {
      outputNode.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.02);
    },
    destroy: () => {
      const nodes: AudioNode[] = [
        highpass,
        toneShelf,
        micGain,
        dryGain,
        echoDelay,
        echoLowpass,
        echoFeedback,
        echoWetGain,
        reverbPreDelay,
        reverbConvolver,
        reverbDamp,
        reverbWetGain,
        masterBus,
        compressor,
        outputNode,
        analyser,
      ];
      for (const n of nodes) {
        try {
          n.disconnect();
        } catch {
          // Ignore disconnect cleanup
        }
      }
    },
  };
}
