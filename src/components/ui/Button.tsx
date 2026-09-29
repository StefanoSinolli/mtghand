import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-150 select-none ' +
  'disabled:opacity-40 disabled:pointer-events-none active:scale-[0.97] cursor-pointer whitespace-nowrap';

const variants: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-gold-300 to-gold-500 text-felt-950 shadow-[0_8px_24px_-8px_rgb(227_189_92/0.7)] hover:from-gold-200 hover:to-gold-400',
  secondary: 'glass text-stone-100 hover:bg-white/10 hover:border-white/20',
  ghost: 'text-stone-300 hover:text-white hover:bg-white/5',
  danger: 'text-red-300 hover:text-white hover:bg-red-500/80 border border-red-400/30',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

const buttonClass = (variant: Variant = 'secondary', size: Size = 'md', extra = '') =>
  `${base} ${variants[variant]} ${sizes[size]} ${extra}`;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export default function Button({ variant, size, className = '', type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

interface ButtonLinkProps extends LinkProps {
  variant?: Variant;
  size?: Size;
}

export function ButtonLink({ variant, size, className = '', ...props }: ButtonLinkProps) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
