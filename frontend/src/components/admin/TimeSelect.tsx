'use client';

interface TimeSelectProps {
  /** เวลาในรูปแบบ HH:MM (24 ชั่วโมง) */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label: string;
  /** ระยะห่างของนาทีที่ให้เลือก (นาที) */
  minuteStep?: number;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const splitTime = (value: string): { hour: number; minute: number } => {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return { hour: 8, minute: 0 };
  return { hour: Number(match[1]), minute: Number(match[2]) };
};

const pad = (n: number): string => String(n).padStart(2, '0');

export default function TimeSelect({
  value,
  onChange,
  disabled = false,
  label,
  minuteStep = 5,
}: TimeSelectProps): React.ReactElement {
  const { hour, minute } = splitTime(value);

  // รวมนาทีปัจจุบันเข้าไปด้วย เผื่อข้อมูลเดิมไม่ได้อยู่บนระยะห่างที่กำหนด
  const minuteOptions = Array.from({ length: Math.floor(60 / minuteStep) }, (_, i) => i * minuteStep);
  if (!minuteOptions.includes(minute)) {
    minuteOptions.push(minute);
    minuteOptions.sort((a, b) => a - b);
  }

  const emit = (nextHour: number, nextMinute: number): void => {
    onChange(`${pad(nextHour)}:${pad(nextMinute)}`);
  };

  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={label}>
      <select
        aria-label={`${label} ชั่วโมง`}
        disabled={disabled}
        value={hour}
        onChange={(e) => emit(Number(e.target.value), minute)}
        className="rounded-xl border border-cream-300 bg-cream-50/70 hover:bg-cream-100/70 px-2.5 py-1.5 text-center text-xs sm:text-sm font-semibold font-mono text-forest-950 transition-all focus:border-forest-700 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-forest-800/15 disabled:opacity-50 cursor-pointer"
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {pad(h)}
          </option>
        ))}
      </select>
      <span className="text-sm font-bold text-charcoal-400 font-mono">:</span>
      <select
        aria-label={`${label} นาที`}
        disabled={disabled}
        value={minute}
        onChange={(e) => emit(hour, Number(e.target.value))}
        className="rounded-xl border border-cream-300 bg-cream-50/70 hover:bg-cream-100/70 px-2.5 py-1.5 text-center text-xs sm:text-sm font-semibold font-mono text-forest-950 transition-all focus:border-forest-700 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-forest-800/15 disabled:opacity-50 cursor-pointer"
      >
        {minuteOptions.map((m) => (
          <option key={m} value={m}>
            {pad(m)}
          </option>
        ))}
      </select>
      <span className="text-xs text-charcoal-500 font-medium">น.</span>
    </div>
  );
}
