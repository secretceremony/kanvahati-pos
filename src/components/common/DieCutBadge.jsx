import React from 'react';

/**
 * Standardized Die-cut Badge component for SKU tags, roles, and promo labels
 */
export default function DieCutBadge({
    children,
    variant = 'yellow',
    size = 'sm',
    className = '',
    rotate = 0
}) {
    const variantStyles = {
        yellow: 'bg-yellow text-text',
        pink: 'bg-pink text-white',
        blue: 'bg-blue-light text-text',
        green: 'bg-emerald-100 text-emerald-800',
        rose: 'bg-rose-100 text-rose-800',
        gray: 'bg-gray-100 text-gray-700'
    };

    const sizeStyles = {
        xs: 'text-[8.5px] px-1.5 py-0.5',
        sm: 'text-[10px] px-2 py-0.5',
        md: 'text-xs px-2.5 py-1'
    };

    const rotateStyle = rotate !== 0 ? { transform: `rotate(${rotate}deg)` } : {};

    return (
        <span
            style={rotateStyle}
            className={`font-tag font-black uppercase tracking-wider rounded-md border border-text shadow-[1px_1px_0px_#181818] inline-flex items-center gap-1 select-none ${variantStyles[variant] || variantStyles.yellow} ${sizeStyles[size] || sizeStyles.sm} ${className}`}
        >
            {children}
        </span>
    );
}
