import React from 'react';

/**
 * Standardized Neobrutalist Tactile Button
 */
export default function NeobrutalistButton({
    children,
    onClick,
    variant = 'primary',
    size = 'md',
    disabled = false,
    className = '',
    type = 'button',
    title = '',
    icon = null
}) {
    const variantStyles = {
        primary: 'bg-pink text-text hover:bg-white',
        secondary: 'bg-yellow text-text hover:bg-white',
        info: 'bg-blue-light text-text hover:bg-white',
        danger: 'bg-white text-rose-700 hover:bg-rose-50',
        white: 'bg-white text-text hover:bg-yellow-light'
    };

    const sizeStyles = {
        sm: 'text-[11px] px-3 py-1',
        md: 'text-xs px-4 py-2',
        lg: 'text-sm px-6 py-2.5 font-black'
    };

    const disabledStyles = 'opacity-50 cursor-not-allowed select-none shadow-none pointer-events-none bg-gray-200 text-gray-400 border-gray-400';

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={`font-title font-bold rounded-full border-2 border-text transition-all flex items-center justify-center gap-1.5 ${
                disabled ? disabledStyles : `${variantStyles[variant] || variantStyles.primary} shadow-[2px_2px_0px_#181818] hover:translate-y-[-1px] active:translate-y-[1px] active:shadow-none cursor-pointer`
            } ${sizeStyles[size] || sizeStyles.md} ${className}`}
        >
            {icon && <span className="shrink-0">{icon}</span>}
            {children}
        </button>
    );
}
