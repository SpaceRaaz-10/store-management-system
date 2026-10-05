import type { HTMLAttributes, ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        success: 'border-transparent bg-emerald-100 text-emerald-700',
        warning: 'border-transparent bg-amber-100 text-amber-700',
        destructive: 'border-transparent bg-red-100 text-red-700',
        outline: 'text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

/**
 * Title-Case a single status word: "active" → "Active",
 * "partially_returned" → "Partially Returned".
 */
function titleCase(input: string): string {
  return input
    .replace(/_/g, ' ')
    .trim()
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/**
 * Recursively walk children. Text nodes get title-cased; elements are
 * walked into so that `<span><Icon /> active</span>` also renders "Active".
 */
function formatNode(node: ReactNode): ReactNode {
  if (typeof node === 'string') return titleCase(node);
  if (typeof node === 'number' || typeof node === 'boolean' || node === null || node === undefined) {
    return node;
  }
  if (Array.isArray(node)) return node.map((n, i) => <span key={i}>{formatNode(n)}</span>);
  // React element — clone with formatted children
  if (typeof node === 'object' && 'props' in (node as object)) {
    const el = node as { props: { children?: ReactNode } };
    return { ...(node as object), props: { ...(node as object).props, children: formatNode(el.props.children) } } as ReactNode;
  }
  return node;
}

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {formatNode(children)}
    </div>
  );
}