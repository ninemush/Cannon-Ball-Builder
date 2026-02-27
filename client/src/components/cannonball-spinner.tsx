import { useId } from "react";

export function CannonballSpinner({ className = "" }: { className?: string }) {
  const gradId = useId();

  return (
    <span className={`inline-flex items-center shrink-0 ${className}`}>
      <svg
        width="14"
        height="14"
        viewBox="0 0 32 24"
        overflow="visible"
        className="cannonball-roll"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" fill="#1a1a1a" />
        <circle cx="12" cy="12" r="9.5" fill={`url(#${gradId})`} />
        <ellipse cx="9" cy="8" rx="3.5" ry="2.5" fill="white" opacity="0.18" transform="rotate(-20 9 8)" />
        <circle cx="8" cy="7" r="1.2" fill="white" opacity="0.25" />
        <line x1="22" y1="12" x2="28" y2="12" stroke="hsl(19 92% 47%)" strokeWidth="2" strokeLinecap="round" opacity="0.7" className="cannonball-trail" />
        <circle cx="25" cy="11" r="1" fill="hsl(45 92% 55%)" opacity="0.6" className="cannonball-spark" />
        <circle cx="27" cy="13" r="0.7" fill="hsl(19 92% 47%)" opacity="0.4" className="cannonball-spark" />
        <defs>
          <radialGradient id={gradId} cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#555" />
            <stop offset="100%" stopColor="#111" />
          </radialGradient>
        </defs>
      </svg>
    </span>
  );
}
