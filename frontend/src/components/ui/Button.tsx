import React, { useState } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ds } from '../../styles/design-system';

export type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'subtle';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  style?: React.CSSProperties;
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: ds.btnPrimary,
  danger: ds.btnDanger,
  ghost: ds.btnGhost,
  subtle: ds.btnSubtle,
};

const variantHover: Record<ButtonVariant, React.CSSProperties> = {
  primary: ds.btnPrimaryHover,
  danger: { filter: 'brightness(1.1)' },
  ghost: ds.btnGhostHover,
  subtle: ds.btnSubtleHover,
};

const sizeAdjust: Record<ButtonSize, React.CSSProperties> = {
  md: {},
  sm: { padding: '6px 12px', fontSize: 12 },
};

/**
 * Canonical portal button. One `primary` per view; destructive flows use
 * `danger`. Ref-capable, with an explicit visible keyboard-focus ring
 * (`:focus-visible` matched in JS). Caller handlers (onClick/onFocus/onBlur/
 * onMouseOver/onMouseOut), `type`, `disabled`, `loading` and `className` are
 * all preserved.
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  disabled,
  children,
  className,
  onMouseOver,
  onMouseOut,
  onFocus,
  onBlur,
  style,
  ...rest
}: ButtonProps, ref) {
  const [hover, setHover] = useState(false);
  const [focusVisible, setFocusVisible] = React.useState(false);
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onMouseOver={(e) => { setHover(true); onMouseOver?.(e); }}
      onMouseOut={(e) => { setHover(false); onMouseOut?.(e); }}
      onFocus={(e) => { setFocusVisible(e.currentTarget.matches(':focus-visible')); onFocus?.(e); }}
      onBlur={(e) => { setFocusVisible(false); onBlur?.(e); }}
      className={className}
      style={{
        ...variantStyles[variant],
        ...sizeAdjust[size],
        ...(hover && !disabled && !loading ? variantHover[variant] : null),
        ...((disabled || loading) ? ds.btnDisabled : null),
        ...(focusVisible ? ds.focusRing : null),
        ...style,
      }}
      {...rest}
    >
      {loading ? <span aria-hidden="true">…</span> : icon}
      {children}
    </button>
  );
});

export default Button;
