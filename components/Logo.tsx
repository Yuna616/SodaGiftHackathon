export default function Logo() {
  return (
    <div className="flex items-center gap-2">
      <span className="relative block h-[38px] w-10 shrink-0">
        <span
          className="absolute left-0.5 top-[3px] grid h-[31px] w-8 -rotate-[4deg] place-items-center bg-accent"
          style={{ borderRadius: '56% 44% 60% 40% / 48% 58% 42% 52%' }}
        >
          <span className="rotate-[4deg] skew-x-[-7deg] font-sodapick text-[21px] font-extrabold leading-none tracking-[-0.5px] text-white">
            s
          </span>
        </span>
        <span className="absolute left-[1px] top-0 h-1 w-2.5 -rotate-[32deg] rounded-full bg-accent" />
        <span className="absolute left-[26px] top-[29px] h-[5px] w-[11px] -rotate-[14deg] rounded-full bg-accent" />
      </span>
      <h1 className="pb-0.5 font-logo text-[25px] leading-[1.15] tracking-[-0.6px] text-ink">SodaPick</h1>
    </div>
  );
}
