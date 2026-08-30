export default function ConsensusBar({
  label,
  percent,
  count,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  percent: number;
  count?: number;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-3 transition ${
        selected ? 'border-soda-500 bg-soda-50' : 'border-gray-200 bg-white'
      } ${disabled ? 'opacity-70' : 'active:scale-[0.99]'}`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-sm font-medium ${selected ? 'text-soda-600' : 'text-gray-800'}`}>{label}</span>
        <span className="text-xs text-gray-500 tabular-nums">
          {count !== undefined ? `${count}명 · ` : ''}
          {percent}%
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${selected ? 'bg-soda-500' : 'bg-gray-300'}`}
          style={{ width: `${Math.max(percent, 2)}%` }}
        />
      </div>
    </button>
  );
}
