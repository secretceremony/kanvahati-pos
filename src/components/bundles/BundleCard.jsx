import React from 'react';
import DieCutBadge from '../common/DieCutBadge';

/**
 * Reusable Bundle Card Component
 */
export default function BundleCard({
    bundle,
    products,
    onEdit,
    onDelete,
    calculateOriginalPrice,
    formatMoney
}) {
    const originalPrice = calculateOriginalPrice(bundle.items);
    const discount = originalPrice - bundle.bundlePrice;

    return (
        <div className={`bundle-card border-[3px] border-text rounded-2xl p-5 relative transition-all flex flex-col ${
            bundle.isActive ? 'bg-white shadow-[5px_5px_0px_#181818]' : 'bg-gray-100 opacity-60'
        }`}>
            {!bundle.isActive && (
                <div className="absolute top-2.5 right-2.5">
                    <DieCutBadge variant="gray">Nonaktif</DieCutBadge>
                </div>
            )}
            
            <h3 className="font-title text-xl text-text leading-tight mb-2 pr-12">{bundle.name}</h3>
            
            <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-xs opacity-60 line-through">{formatMoney(originalPrice)}</span>
                <span className="font-bold text-pink text-lg font-title">{formatMoney(bundle.bundlePrice)}</span>
                {discount > 0 && (
                    <DieCutBadge variant="yellow" rotate={-2}>
                        HEMAT {formatMoney(discount)}
                    </DieCutBadge>
                )}
            </div>

            <div className="bg-blue-light/30 border-2 border-text/20 rounded-xl p-3 mb-4 flex-grow">
                <h4 className="text-[11px] font-bold uppercase mb-2 opacity-80 font-tag tracking-wider">Item Bundle:</h4>
                <ul className="text-xs space-y-1.5 font-body">
                    {bundle.items.map((item, idx) => {
                        const prod = products.find(p => p.id === item.productId);
                        return (
                            <li key={idx} className="flex items-start gap-2">
                                <i className="fa-solid fa-check text-pink mt-0.5 text-[10px]"></i>
                                <span className="flex-grow font-medium">
                                    {prod ? prod.name : 'Produk Dihapus'} 
                                    {item.variationName && <span className="text-[10px] opacity-70 ml-1">({item.variationName})</span>}
                                </span>
                                <span className="font-bold font-tag">x{item.qty}</span>
                            </li>
                        );
                    })}
                </ul>
            </div>

            <div className="flex gap-2 mt-auto">
                <button 
                    type="button"
                    onClick={onEdit}
                    className="flex-1 bg-blue-light border-2 border-text rounded-full py-1.5 text-xs font-bold font-title shadow-[2px_2px_0px_#181818] hover:bg-white active:translate-y-[1px] active:shadow-none transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                    <i className="fa-solid fa-pen text-[11px]"></i> Edit
                </button>
                <button 
                    type="button"
                    onClick={onDelete}
                    className="bg-white text-pink border-2 border-text rounded-full px-4 py-1.5 text-xs shadow-[2px_2px_0px_#181818] hover:bg-pink-light active:translate-y-[1px] active:shadow-none transition-all cursor-pointer flex items-center justify-center"
                    title="Hapus bundle"
                >
                    <i className="fa-solid fa-trash text-[11px]"></i>
                </button>
            </div>
        </div>
    );
}
