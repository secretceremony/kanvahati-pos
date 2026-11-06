import React from 'react';

/**
 * Standardized Retro OS Window Component for Kanvahati Neobrutalism
 */
export default function RetroWindow({ 
    title, 
    badge, 
    headerColor = 'blue', 
    children, 
    className = '',
    headerClassName = '',
    actions = null 
}) {
    const colorClasses = {
        blue: 'bg-blue text-text',
        yellow: 'bg-yellow text-text',
        pink: 'bg-pink text-text',
        white: 'bg-white text-text'
    };

    return (
        <div className={`retro-window-container bg-white border-[3px] border-text rounded-2xl shadow-pop overflow-hidden flex flex-col relative ${className}`}>
            <div className={`retro-window-header border-b-[2.5px] border-text px-3.5 py-2 flex items-center justify-between shrink-0 ${colorClasses[headerColor] || colorClasses.blue} ${headerClassName}`}>
                <div className="flex items-center gap-1.5">
                    <div className="retro-dots hidden sm:flex items-center gap-1.5 mr-1">
                        <span className="retro-dot retro-dot-red"></span>
                        <span className="retro-dot retro-dot-yellow"></span>
                        <span className="retro-dot retro-dot-blue"></span>
                    </div>
                    {title && (
                        <span className="font-tag text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-text">
                            {title}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {actions}
                    {badge && (
                        <span className="text-[10px] font-tag font-black uppercase bg-white border border-text px-2 py-0.5 rounded shadow-[1px_1px_0px_#181818]">
                            {badge}
                        </span>
                    )}
                </div>
            </div>

            <div className="retro-window-body flex-grow flex flex-col p-4 sm:p-5 bg-[#FFFDF9] overflow-visible">
                {children}
            </div>
        </div>
    );
}
