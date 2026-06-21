import type { SVGProps } from "react";

function iconDefaults(props: SVGProps<SVGSVGElement>) {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

export function UserIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconDefaults(props)}>
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="7.5" r="4" />
    </svg>
  );
}

export function MailIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconDefaults(props)}>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m4.5 7.5 7.5 6 7.5-6" />
    </svg>
  );
}

export function LockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconDefaults(props)}>
      <rect x="4.5" y="10" width="15" height="10" rx="2.5" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
      <path d="M12 13.5v3" />
    </svg>
  );
}

export function EyeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconDefaults(props)}>
      <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  );
}

export function EyeOffIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconDefaults(props)}>
      <path d="M3.5 4.5 20.5 19.5" />
      <path d="M10.6 5.7A9.8 9.8 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a20 20 0 0 1-3.5 4.4" />
      <path d="M7.3 7.4A19 19 0 0 0 2.5 12S6 18.5 12 18.5a10 10 0 0 0 2-.2" />
      <path d="M9.8 9.9A3.2 3.2 0 0 0 14 14.1" />
    </svg>
  );
}

export function LeafLogoMark() {
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="leafGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3db092" />
          <stop offset="100%" stopColor="#178664" />
        </linearGradient>
      </defs>
      <rect x="12" y="12" width="96" height="96" rx="26" fill="url(#leafGradient)" />
      <path
        d="M57 29.5c-7.8 3-14 10.8-15.1 20.1-1.1 9.5 2.8 18.5 9.9 24 3.9 3 8.8 5 14 5.6 1-.1 2.1-.3 3.1-.5 2.8-8.2 2.2-18.7-2.2-27.8-4.1-8.6-11.4-15.7-9.7-21.4Z"
        fill="#ffffff"
        opacity="0.98"
      />
      <path
        d="M44.4 57.2c-5.5.3-11 3.1-14.3 7.5-3.4 4.5-4.4 10.6-2.9 16 5.2 2.2 11.8 1.9 17.5-1 5.4-2.8 9.4-7.6 10.4-12.6-2.1-4.4-6.6-9.7-10.7-9.9Z"
        fill="#ffffff"
      />
      <path
        d="M76.2 56.5c-5.3 2.4-9.8 7.2-11.5 12.8-1.8 5.9-.8 12.6 2.7 17.8 5.8.4 12.2-1.8 16.5-6.1 4.3-4.3 6.4-10.8 5.3-16.5-2.7-4.4-7-7.5-13-8Z"
        fill="#ffffff"
      />
      <path d="M62.5 82.3c6.2 1 12.2 4.6 16.1 9.7" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function EyeToggleIcon({ open }: { open: boolean }) {
  return open ? <EyeIcon className="h-5 w-5" /> : <EyeOffIcon className="h-5 w-5" />;
}

export function MenuDotsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconDefaults(props)}>
      <circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconDefaults(props)}>
      <circle cx="11" cy="11" r="5.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

export function BellIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconDefaults(props)}>
      <path d="M8 18a4 4 0 0 0 8 0" />
      <path d="M6 16h12c-.7-.7-1.5-1.8-1.5-4.4V9a4.5 4.5 0 1 0-9 0v2.6C7.5 14.2 6.7 15.3 6 16Z" />
    </svg>
  );
}

export function NotificationsSharpIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <path d="M19 17V11c0-3.1-1.6-5.8-4.5-7V3h-5v1c-2.9 1.2-4.5 3.9-4.5 7v6L3 19v1h18v-1l-2-2Zm-7 5c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2Z" />
    </svg>
  );
}

export function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconDefaults(props)}>
      <path d="m6.5 9 5.5 5.5L17.5 9" />
    </svg>
  );
}

export function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconDefaults(props)}>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 9h18" />
      <path d="M8 13h2M12 13h2M16 13h2M8 17h2M12 17h2" />
    </svg>
  );
}

export function DashboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconDefaults(props)}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function CartIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconDefaults(props)}>
      <circle cx="9" cy="19" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="17" cy="19" r="1.4" fill="currentColor" stroke="none" />
      <path d="M3 4h2l2.2 11h9.8l2-7H6" />
    </svg>
  );
}

export function BagIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconDefaults(props)}>
      <path d="M7 8V7a5 5 0 0 1 10 0v1" />
      <rect x="4" y="8" width="16" height="13" rx="2.5" />
      <path d="M9 12v2M15 12v2" />
    </svg>
  );
}

export function FactoryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconDefaults(props)}>
      <path d="M4 20V9l5 3V9l5 3V7l6 3v10z" />
      <path d="M8 20v-4h3v4M14 20v-6h3v6" />
    </svg>
  );
}

export function BoxIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconDefaults(props)}>
      <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5z" />
      <path d="M12 4v16M4 8.5l8 4.5 8-4.5" />
    </svg>
  );
}

export function ShieldIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconDefaults(props)}>
      <path d="M12 3.5 19 6v6.2c0 4.6-3 7.4-7 9.3-4-1.9-7-4.7-7-9.3V6z" />
      <path d="m9.5 11.8 1.6 1.6 3.5-3.5" />
    </svg>
  );
}

export function TruckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconDefaults(props)}>
      <path d="M3 7h11v8H3z" />
      <path d="M14 10h3.5L21 13v2h-7z" />
      <circle cx="8" cy="18" r="1.8" />
      <circle cx="17" cy="18" r="1.8" />
    </svg>
  );
}

export function ClockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconDefaults(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}

export function ReceiptIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconDefaults(props)}>
      <path d="M6 3h12v18l-2.5-1.8L13 21l-2.5-1.8L8 21V3z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  );
}
