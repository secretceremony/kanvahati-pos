import React from 'react';

export default function BundleSuggestionBanner({ bundles, onApply, onDismiss }) {
    if (!bundles || bundles.length === 0) return null;

    // We cap the display to max 2 banners to avoid cluttering the UI
    const displayedBundles = bundles.slice(0, 2);
    const hiddenCount = bundles.length - 2;

    const formatMoney = (value) => {
        return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
    };

    return (
        <div className="absolute bottom-full left-0 w-full mb-3 px-4 z-50 flex flex-col gap-2">
            {displayedBundles.map((bundle, index) => {
                const discount = bundle.originalPrice - bundle.bundlePrice;
                return (
                    <div 
                        key={bundle.id} 
                        className="bg-yellow-light border-[3px] border-text rounded-xl p-3 shadow-[4px_4px_0px_#32628f] animate-[ticketSlide_0.3s_ease-out] relative flex items-center justify-between"
                    >
                        <div className="flex-1 pr-2">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="bg-pink text-text text-[10px] font-bold px-2 py-0.5 rounded-full uppercase transform -rotate-2">
                                    Promo
                                </span>
                                <h4 className="font-title text-[14px] text-text title-stroke leading-tight">{bundle.name}</h4>
                            </div>
                            
                            <p className="text-xs opacity-80 mb-1 line-clamp-1">
                                {bundle.items.map(i => `${i.name} x${i.qty}`).join(' + ')}
                            </p>
                            
                            <div className="flex items-center gap-2 text-sm">
                                <span className="line-through opacity-60 text-xs">{formatMoney(bundle.originalPrice)}</span>
                                <span className="font-bold text-pink">{formatMoney(bundle.bundlePrice)}</span>
                                {discount > 0 && (
                                    <span className="text-[10px] font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded">
                                        Hemat {formatMoney(discount)}
                                    </span>
                                )}
                            </div>
                        </div>
                        
                        <div className="flex flex-col gap-1.5 shrink-0">
                            <button 
                                onClick={() => onApply(bundle)}
                                className="bg-pink text-text border-2 border-text rounded-full px-3 py-1.5 text-xs font-bold shadow-[2px_2px_0px_#32628f] hover:translate-y-[-1px] transition-all cursor-pointer flex items-center justify-center gap-1"
                            >
                                <i className="fa-solid fa-check"></i> Pakai
                            </button>
                            <button 
                                onClick={() => onDismiss(bundle.id)}
                                className="bg-white text-text border-2 border-text rounded-full px-3 py-1 text-[10px] font-bold hover:bg-gray-100 transition-all cursor-pointer"
                            >
                                Lewati
                            </button>
                        </div>
                    </div>
                );
            })}
            
            {hiddenCount > 0 && (
                <div className="text-center bg-blue-light/80 border-2 border-text rounded-full py-1 text-xs font-bold shadow-sm backdrop-blur-sm">
                    + {hiddenCount} promo lainnya tersedia
                </div>
            )}
        </div>
    );
}
