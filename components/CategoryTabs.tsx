const CATEGORIES = [
  { id: 'all', label: '전체' },
  { id: 'kpop', label: 'K팝' },
  { id: 'esports', label: 'e스포츠' },
  { id: 'variety', label: '예능' },
  { id: 'drama', label: '드라마' },
];

export default function CategoryTabs({
  active,
  onChange,
}: {
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 pb-1">
      {CATEGORIES.map((c) => (
        <button
          key={c.id}
          onClick={() => onChange(c.id)}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium border ${
            active === c.id
              ? 'bg-soda-500 text-white border-soda-500'
              : 'bg-white text-gray-600 border-gray-200'
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
