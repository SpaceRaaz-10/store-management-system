import { cn } from '@/lib/utils';

interface LogoProps {
  size?: number;
  className?: string;
  /** "full" shows icon + wordmark; "mark" shows only the icon */
  variant?: 'mark' | 'full';
  /** Override the accent color; defaults to currentColor */
  accentColor?: string;
  /** Override the container background; defaults to primary */
  backgroundColor?: string;
}

/**
 * Store Management System logo.
 *
 * Design: a rounded-square app-tile housing a stylized storefront awning
 * layered over a subtle price-tag swoosh. Built with pure SVG so it's crisp
 * at any size and takes theme colors automatically.
 */
export function Logo({
  size = 32,
  className,
  variant = 'full',
  accentColor,
  backgroundColor,
}: LogoProps) {
  const mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Store Management System"
      className={cn('shrink-0', className)}
    >
      {/* Rounded app-tile background */}
      <rect
        x="0"
        y="0"
        width="64"
        height="64"
        rx="14"
        fill={backgroundColor ?? 'currentColor'}
      />

      {/* Storefront awning (top striped canopy) */}
      <g fill="#ffffff">
        {/* Awning base shape */}
        <path d="M12 22 L52 22 L52 26 Q52 28 50 28 L14 28 Q12 28 12 26 Z" opacity="0.95" />
        {/* Awning scallops (5 triangular folds) */}
        <path d="M12 28 L16 34 L20 28 L24 34 L28 28 L32 34 L36 28 L40 34 L44 28 L48 34 L52 28 Z" opacity="0.95" />
      </g>

      {/* Storefront door / counter */}
      <rect x="18" y="38" width="28" height="12" rx="2" fill="#ffffff" opacity="0.75" />

      {/* Door handle (small dot) */}
      <circle cx="42" cy="44" r="1.4" fill={backgroundColor ?? 'currentColor'} opacity="0.9" />

      {/* Subtle accent swoosh (price-tag flourish) */}
      <path
        d="M14 56 Q32 60 50 56"
        stroke={accentColor ?? '#60a5fa'}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      />
    </svg>
  );

  if (variant === 'mark') return mark;

  return (
    <div className="flex items-center gap-2.5">
      <div className="text-primary">{mark}</div>
      <div className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-tight text-foreground">
          Store Management
        </span>
        <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          System
        </span>
      </div>
    </div>
  );
}