'use client';

export type PickBarVariant = 'locked' | 'muted' | 'primary' | 'invite' | 'hidden';

export default function FloatingPickBar({
  variant,
  label,
  subtext,
  onClick,
}: {
  variant: PickBarVariant;
  label: string;
  subtext?: string;
  onClick: () => void;
}) {
  if (variant === 'hidden') return null;

  const styles: Record<Exclude<PickBarVariant, 'hidden'>, string> = {
    locked: 'bg-white text-gray-900 border border-gray-300',
    muted: 'bg-gray-100 text-gray-400',
    primary: 'bg-black text-white',
    invite: 'bg-soda-500 text-white',
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-gray-100">
      <div className="tab-bar px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+10px)]">
        {subtext && <p className="text-center text-[11px] text-gray-400 mb-1.5">{subtext}</p>}
        <button
          onClick={onClick}
          className={`w-full rounded-xl py-3.5 text-sm font-semibold transition active:scale-[0.98] ${styles[variant]}`}
        >
          {label}
        </button>
      </div>
    </div>
  );
}
