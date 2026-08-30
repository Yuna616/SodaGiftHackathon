const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'kpop', label: 'K-Pop' },
  { id: 'esports', label: 'Esports' },
  { id: 'variety', label: 'Variety' },
  { id: 'drama', label: 'Drama' },
  { id: 'beauty', label: 'Beauty' },
];

export default function CategoryTabs({
  active,
  onChange,
}: {
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto px-1">
      {CATEGORIES.map((c) => (
        <button
          key={c.id}
          onClick={() => onChange(c.id)}
          className={`shrink-0 rounded-full px-4 py-2.5 text-[13.5px] font-bold ${
            active === c.id ? 'bg-ink text-white' : 'bg-white text-[#5A6068]'
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
