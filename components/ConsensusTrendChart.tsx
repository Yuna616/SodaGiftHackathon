import type { CampaignOption, ConsensusTrendPoint } from '@/lib/types';

// 검증된 카테고리 팔레트(dataviz 스킬)의 앞 4개 슬롯 — 인접쌍 CVD 대비가 확인된 순서
const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'];

const WIDTH = 343;
const HEIGHT = 190;
const PAD_TOP = 12;
const PAD_BOTTOM = 26;
const PAD_LEFT = 30;
const PAD_RIGHT = 8;
const PLOT_W = WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_H = HEIGHT - PAD_TOP - PAD_BOTTOM;

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ConsensusTrendChart({
  options,
  points,
}: {
  options: CampaignOption[];
  points: ConsensusTrendPoint[];
}) {
  if (points.length < 2) {
    return (
      <div className="rounded-xl bg-gray-50 py-10 text-center text-xs text-gray-400">
        추이를 표시할 만큼 예측 데이터가 아직 없어요
      </div>
    );
  }

  const times = points.map((p) => new Date(p.at).getTime());
  const minT = times[0];
  const maxT = times[times.length - 1];
  const span = Math.max(maxT - minT, 1);

  const xAt = (t: number) => PAD_LEFT + ((t - minT) / span) * PLOT_W;
  const yAt = (percent: number) => PAD_TOP + PLOT_H - (percent / 100) * PLOT_H;

  const series = options.map((opt, i) => {
    const coords = points.map((p) => ({ x: xAt(new Date(p.at).getTime()), y: yAt(p.percents[opt.id] ?? 0) }));
    const d = coords.map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
    const last = coords[coords.length - 1];
    const latestPercent = points[points.length - 1].percents[opt.id] ?? 0;
    return { opt, color: SERIES_COLORS[i % SERIES_COLORS.length], d, last, latestPercent };
  });

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="옵션별 선택 비중 추이">
        {[0, 50, 100].map((g) => (
          <g key={g}>
            <line
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={yAt(g)}
              y2={yAt(g)}
              stroke="#e1e0d9"
              strokeWidth={1}
            />
            <text x={0} y={yAt(g) + 3} fontSize={9} fill="#898781">
              {g}%
            </text>
          </g>
        ))}

        {series.map((s) => (
          <path key={s.opt.id} d={s.d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {series.map((s) => (
          <circle key={`${s.opt.id}-dot`} cx={s.last.x} cy={s.last.y} r={4} fill={s.color} stroke="#ffffff" strokeWidth={2} />
        ))}

        <text x={PAD_LEFT} y={HEIGHT - 6} fontSize={9} fill="#898781">
          {formatTime(points[0].at)}
        </text>
        <text x={WIDTH - PAD_RIGHT} y={HEIGHT - 6} fontSize={9} fill="#898781" textAnchor="end">
          {formatTime(points[points.length - 1].at)}
        </text>
      </svg>

      <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2">
        {series.map((s) => (
          <div key={s.opt.id} className="flex items-center gap-1.5 text-xs">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-gray-600">{s.opt.label}</span>
            <span className="text-gray-400 tabular-nums">{s.latestPercent}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
