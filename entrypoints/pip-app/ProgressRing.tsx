/**
 * Thin circular countdown showing time-until-next-advance.
 * `progress` is 0..1 (0 = just advanced, 1 = about to advance).
 */
export function ProgressRing({ progress, paused }: { progress: number; paused: boolean }) {
  const size = 22;
  const stroke = 2.5;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const dash = circumference * Math.min(Math.max(progress, 0), 1);

  return (
    <svg width={size} height={size} className="shrink-0" aria-hidden>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={paused ? '#facc15' : '#1d9bf0'}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}
