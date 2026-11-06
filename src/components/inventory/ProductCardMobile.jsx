import React from 'react';
import DieCutBadge from '../common/DieCutBadge';

/**
 * Mobile-first Neobrutalist Product Card
 */
export default function ProductCardMobile({
    product,
    selected,
    onSelect,
    onRestock,
    onEdit,
    onDelete,
    onToggleVisibility,
    expanded,
    onToggleExpand,
    formatPrice,
    getCategoryDisplayLabel
}) {
    const isLowStock = product.stock <= 5;
    const hasVars = product.variations && product.variations.length > 0;

    return (
        <div className={`border-2 border-text rounded-xl p-3.5 shadow-[2px_2px_0px_#181818] flex flex-col gap-2.5 transition-all ${
            isLowStock ? 'bg-pink-light/30' : 'bg-yellow-light/20'
        }`}>
            {/* Top Bar: Checkbox, SKU ID & Stock Badge */}
            <div className="flex justify-between items-start gap-2 border-b border-dashed border-text/20 pb-2">
                <div className="flex items-start gap-2 min-w-0">
                    <input 
                        type="checkbox" 
                        checked={selected} 
                        onChange={(e) => onSelect(e.target.checked)}
                        className="w-4 h-4 cursor-pointer accent-pink mt-0.5 shrink-0"
                    />
                    <div className="min-w-0">
                        <span className="font-mono text-[10px] font-bold opacity-60 block truncate">{product.id}</span>
                        <h4 className="font-title font-bold text-sm text-text leading-tight mt-0.5 line-clamp-2">{product.name}</h4>
                    </div>
                </div>
                <DieCutBadge variant={isLowStock ? 'rose' : 'green'}>
                    Stok: {product.stock}
                </DieCutBadge>
            </div>

            {/* Price and Category info */}
            <div className="flex justify-between items-center text-xs">
                <div>
                    <span className="text-[10px] opacity-70 uppercase block font-bold font-tag">Harga</span>
                    <span className="font-title font-bold text-sm text-pink">
                        {formatPrice(hasVars ? Math.min(...product.variations.map(v => v.price)) : product.price)}
                        {hasVars && <span className="text-[9px] block font-body opacity-70 font-normal">(Mulai dari)</span>}
                    </span>
                </div>
                <div className="text-right">
                    <span className="text-[10px] opacity-70 uppercase block font-bold font-tag">Kategori</span>
                    <span className="font-bold text-xs">{getCategoryDisplayLabel(product.category)}</span>
                </div>
            </div>

            {/* Collapsible Variations Box */}
            {hasVars && (
                <div className="bg-white/90 border border-text rounded-lg p-2.5 mt-0.5">
                    <div 
                        onClick={onToggleExpand}
                        className="flex justify-between items-center cursor-pointer text-xs font-title font-bold text-blue select-none"
                    >
                        <span>{product.variations.length} Variasi Tersedia</span>
                        <i className={`fa-solid fa-chevron-down transition-transform ${expanded ? 'rotate-180' : ''}`}></i>
                    </div>
                    {expanded && (
                        <div className="divide-y divide-text/10 mt-2 pt-1">
                            {product.variations.map((v, i) => (
                                <div key={i} className="py-2 flex justify-between items-center text-[11.5px]">
                                    <div className="flex flex-col">
                                        <span className="font-bold">{v.name}</span>
                                        <span className="font-mono text-pink">{formatPrice(v.price)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="bg-yellow-light border border-text rounded px-2 py-0.5 font-mono text-[10px] font-bold">{v.stock} pcs</span>
                                        <button 
                                            type="button"
                                            onClick={() => onRestock(v.name)}
                                            className="btn bg-blue-light text-text border border-text rounded px-2.5 py-1 text-[10px] font-bold shadow-[1px_1px_0px_#181818] active:translate-y-[1px] cursor-pointer"
                                            title="Tambah stok"
                                        >
                                            +Stok
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Action Bar: 2x2 Grid Layout for Mobile View */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-dashed border-text/20">
                <button 
                    type="button"
                    onClick={onToggleVisibility}
                    className={`btn border-2 border-text rounded-full font-title text-[11px] py-2 shadow-[1.5px_1.5px_0px_#181818] active:translate-y-[1px] active:shadow-none flex items-center justify-center gap-1.5 font-bold cursor-pointer transition-all ${
                        product.hiddenFromCatalogue ? 'bg-pink text-text hover:bg-white' : 'bg-yellow text-text hover:bg-white'
                    }`}
                >
                    <i className={`fa-solid ${product.hiddenFromCatalogue ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    <span>{product.hiddenFromCatalogue ? 'Tersembunyi' : 'Katalog Aktif'}</span>
                </button>

                {!hasVars ? (
                    <button 
                        type="button"
                        onClick={() => onRestock()}
                        className="btn bg-blue-light text-text border-2 border-text rounded-full font-title text-[11px] py-2 shadow-[1.5px_1.5px_0px_#181818] active:translate-y-[1px] active:shadow-none flex items-center justify-center gap-1.5 font-bold cursor-pointer hover:bg-white transition-all"
                    >
                        <i className="fa-solid fa-box-open"></i> +Stok
                    </button>
                ) : (
                    <button 
                        type="button"
                        onClick={onToggleExpand}
                        className="btn bg-yellow-light text-text border-2 border-text rounded-full font-title text-[11px] py-2 shadow-[1.5px_1.5px_0px_#181818] active:translate-y-[1px] active:shadow-none flex items-center justify-center gap-1.5 font-bold cursor-pointer hover:bg-white transition-all"
                    >
                        <i className="fa-solid fa-layer-group"></i> Variasi
                    </button>
                )}

                <button 
                    type="button"
                    onClick={onEdit}
                    className="btn bg-white text-text border-2 border-text rounded-full font-title text-[11px] py-2 shadow-[1.5px_1.5px_0px_#181818] active:translate-y-[1px] active:shadow-none flex items-center justify-center gap-1.5 font-bold cursor-pointer hover:bg-yellow-light transition-all"
                >
                    <i className="fa-solid fa-pen"></i> Edit
                </button>

                <button 
                    type="button"
                    onClick={onDelete}
                    className="btn bg-white text-rose-700 border-2 border-text rounded-full py-2 font-title text-[11px] shadow-[1.5px_1.5px_0px_#181818] active:translate-y-[1px] active:shadow-none flex items-center justify-center gap-1.5 hover:bg-rose-50 cursor-pointer transition-all"
                >
                    <i className="fa-solid fa-trash"></i> Hapus
                </button>
            </div>
        </div>
    );
}
