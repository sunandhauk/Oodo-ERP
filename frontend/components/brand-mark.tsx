export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <div className={`relative ${className}`} aria-hidden="true">
      <svg viewBox="0 0 240 240" className="h-full w-full" role="img" aria-label="ERP logo">
        <circle
          cx="120"
          cy="120"
          r="88"
          fill="none"
          stroke="#000000"
          strokeWidth="18"
          strokeLinecap="round"
          strokeDasharray="410 140"
          transform="rotate(-92 120 120)"
        />
        <circle
          cx="120"
          cy="120"
          r="80"
          fill="none"
          stroke="#000000"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray="305 85"
          transform="rotate(16 120 120)"
          opacity="0.95"
        />
        <circle
          cx="120"
          cy="120"
          r="96"
          fill="none"
          stroke="#000000"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray="290 190"
          transform="rotate(132 120 120)"
          opacity="0.98"
        />
        <text
          x="120"
          y="143"
          textAnchor="middle"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="82"
          fontWeight="900"
          letterSpacing="-6"
          fill="#000000"
        >
          ERP
        </text>
      </svg>
    </div>
  );
}
