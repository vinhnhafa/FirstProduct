import { Mic, RotateCcw, SlidersHorizontal, Volume2, VolumeX } from 'lucide-react';
import {
  DEFAULT_VOCAL_DSP_SETTINGS,
  detectVocalDspPreset,
  VOCAL_DSP_PRESETS,
  VocalDspSettings,
} from '../utils/vocalDsp';

interface VocalDspPanelProps {
  settings: VocalDspSettings;
  onChange: (next: VocalDspSettings) => void;
  isMicActive: boolean;
  micLevel: number;
  monitorMuted?: boolean;
  onToggleMonitorMuted?: () => void;
  showMonitorToggle?: boolean;
  compact?: boolean;
}

export function VocalDspPanel({
  settings,
  onChange,
  isMicActive,
  micLevel,
  monitorMuted = false,
  onToggleMonitorMuted,
  showMonitorToggle = false,
  compact = false,
}: VocalDspPanelProps) {
  const activePreset = detectVocalDspPreset(settings);

  const updateField = <K extends keyof VocalDspSettings>(key: K, value: VocalDspSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div
      className={`rounded-xl bg-[#0D111A] border border-slate-800/90 ${
        compact ? 'p-3.5 space-y-3' : 'p-4 space-y-3.5'
      }`}
    >
      {/* Header + Presets + Live VU Meter */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-400">
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-slate-100">
                Hiệu Ứng Âm Thanh Mic (DSP)
              </h3>
              {isMicActive && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-[10px] font-semibold text-emerald-300">
                  <Mic className="w-2.5 h-2.5 animate-pulse" />
                  Đang thu
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              Điều chỉnh Echo, Reverb &amp; chất giọng trực tiếp theo thời gian thực
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isMicActive && (
            <div
              className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 px-2.5 py-1 rounded-lg"
              title="Mức tín hiệu Micro đầu vào"
            >
              <span className="text-[10px] text-slate-400 font-medium">Mức Mic</span>
              <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-400 transition-all duration-75"
                  style={{ width: `${micLevel}%` }}
                />
              </div>
            </div>
          )}

          {showMonitorToggle && isMicActive && onToggleMonitorMuted && (
            <button
              type="button"
              onClick={onToggleMonitorMuted}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
                monitorMuted
                  ? 'bg-rose-500/15 border-rose-500/35 text-rose-300'
                  : 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
              }`}
              title="Bật hoặc tắt nghe lại giọng mic qua loa thiết bị"
            >
              {monitorMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span>{monitorMuted ? 'Đang tắt loa Mic' : 'Nghe giọng qua loa'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_VOCAL_DSP_SETTINGS })}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 transition-colors cursor-pointer"
            title="Khôi phục thông số DSP mặc định"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Mặc định</span>
          </button>
        </div>
      </div>

      {/* Quick Presets */}
      <div className="flex flex-wrap items-center gap-1.5">
        {VOCAL_DSP_PRESETS.map((preset) => {
          const isSelected = activePreset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onChange({ ...preset.settings })}
              title={preset.description}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer border ${
                isSelected
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-slate-100'
              }`}
            >
              {preset.label}
            </button>
          );
        })}
        {activePreset === 'custom' && (
          <span className="px-2 py-1 rounded-lg text-[11px] font-medium bg-purple-500/15 text-purple-300 border border-purple-500/35">
            Tùy chỉnh
          </span>
        )}
      </div>

      {/* 5 Real-Time DSP Sliders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-3 pt-1">
        {/* Echo Level */}
        <label className="flex flex-col gap-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-300 font-medium">Độ vang Echo</span>
            <span className="font-mono text-amber-300 tabular-nums">{settings.echoLevel}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={settings.echoLevel}
            onChange={(e) => updateField('echoLevel', Number(e.target.value))}
            aria-label="Độ vang Echo"
            className="karaoke-range w-full"
            style={{
              background: `linear-gradient(to right, #F59E0B ${settings.echoLevel}%, #1E293B ${settings.echoLevel}%)`,
              height: '5px',
              borderRadius: '9999px',
            }}
          />
        </label>

        {/* Echo Delay Time */}
        <label className="flex flex-col gap-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-300 font-medium">Nhịp trễ Echo</span>
            <span className="font-mono text-amber-300 tabular-nums">{settings.echoDelayMs} ms</span>
          </div>
          <input
            type="range"
            min={80}
            max={420}
            step={5}
            value={settings.echoDelayMs}
            onChange={(e) => updateField('echoDelayMs', Number(e.target.value))}
            aria-label="Nhịp trễ Echo"
            className="karaoke-range w-full"
            style={{
              background: `linear-gradient(to right, #F59E0B ${((settings.echoDelayMs - 80) / 340) * 100}%, #1E293B ${((settings.echoDelayMs - 80) / 340) * 100}%)`,
              height: '5px',
              borderRadius: '9999px',
            }}
          />
        </label>

        {/* Reverb Level */}
        <label className="flex flex-col gap-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-300 font-medium">Độ ngân Reverb</span>
            <span className="font-mono text-purple-300 tabular-nums">{settings.reverbLevel}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={settings.reverbLevel}
            onChange={(e) => updateField('reverbLevel', Number(e.target.value))}
            aria-label="Độ ngân Reverb"
            className="karaoke-range w-full"
            style={{
              background: `linear-gradient(to right, #A855F7 ${settings.reverbLevel}%, #1E293B ${settings.reverbLevel}%)`,
              height: '5px',
              borderRadius: '9999px',
            }}
          />
        </label>

        {/* Mic Gain */}
        <label className="flex flex-col gap-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-300 font-medium">Âm lượng Mic</span>
            <span className="font-mono text-emerald-300 tabular-nums">{settings.micGain}%</span>
          </div>
          <input
            type="range"
            min={40}
            max={160}
            value={settings.micGain}
            onChange={(e) => updateField('micGain', Number(e.target.value))}
            aria-label="Âm lượng Mic"
            className="karaoke-range w-full"
            style={{
              background: `linear-gradient(to right, #10B981 ${((settings.micGain - 40) / 120) * 100}%, #1E293B ${((settings.micGain - 40) / 120) * 100}%)`,
              height: '5px',
              borderRadius: '9999px',
            }}
          />
        </label>

        {/* Vocal Tone (Treble/Clarity) */}
        <label className="flex flex-col gap-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-300 font-medium">Sáng giọng (Treble)</span>
            <span className="font-mono text-sky-300 tabular-nums">
              {settings.vocalTone > 0 ? `+${settings.vocalTone}` : settings.vocalTone} dB
            </span>
          </div>
          <input
            type="range"
            min={-6}
            max={6}
            step={1}
            value={settings.vocalTone}
            onChange={(e) => updateField('vocalTone', Number(e.target.value))}
            aria-label="Sáng giọng Treble"
            className="karaoke-range w-full"
            style={{
              background: `linear-gradient(to right, #38BDF8 ${((settings.vocalTone + 6) / 12) * 100}%, #1E293B ${((settings.vocalTone + 6) / 12) * 100}%)`,
              height: '5px',
              borderRadius: '9999px',
            }}
          />
        </label>

        <div className="flex items-end text-[11px] text-slate-400 leading-snug">
          <span>
            Mẹo: Dùng tai nghe hoặc mic rời hướng ra xa loa để tránh hú rít khi bật Reverb/Echo cao.
          </span>
        </div>
      </div>
    </div>
  );
}
