export default function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <g stroke="#06100c" strokeWidth="2">
        <rect x="14" y="14" width="22" height="32" rx="3" fill="#8a6d2b" transform="rotate(-18 25 46)" />
        <rect x="21" y="12" width="22" height="32" rx="3" fill="#c9a44c" />
        <rect x="28" y="14" width="22" height="32" rx="3" fill="#e8c874" transform="rotate(18 39 46)" />
      </g>
    </svg>
  );
}
