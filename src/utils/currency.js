/**
 * Integer-only Indonesian Rupiah helpers & POS discount math.
 * Prevents floating-point decimals anywhere in prices, discounts, totals, or receipts.
 */

export const toIntRupiah = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    const num = typeof value === 'number'
        ? value
        : Number(String(value).replace(/[^0-9.-]/g, ''));
    if (!Number.isFinite(num)) return 0;
    return Math.max(0, Math.round(num));
};

export const sanitizeIntegerInput = (rawValue) => {
    const digits = String(rawValue ?? '').replace(/[^0-9]/g, '');
    if (!digits) return '';
    return String(parseInt(digits, 10));
};

export const formatRupiah = (value) => {
    return `Rp ${toIntRupiah(value).toLocaleString('id-ID')}`;
};

export const calculateTicketTotals = (ticket = [], products = [], rawTransactionDiscount = 0) => {
    let qty = 0;
    let subtotal = 0;
    let totalItemDiscount = 0;
    const appliedBundles = [];

    (ticket || []).forEach((item) => {
        if (item.isBundle) {
            const bundleItems = item.bundleItems || [];
            qty += bundleItems.reduce((sum, b) => sum + (parseInt(b.qty, 10) || 0), 0);

            let originalPrice = 0;
            bundleItems.forEach((bItem) => {
                const prod = products.find((p) => p.id === bItem.productId);
                if (prod) {
                    let price = toIntRupiah(prod.price);
                    if (bItem.variationName && prod.variations) {
                        const variation = prod.variations.find((v) => v.name === bItem.variationName);
                        if (variation) price = toIntRupiah(variation.price);
                    }
                    originalPrice += price * (parseInt(bItem.qty, 10) || 1);
                }
            });

            const bundlePrice = toIntRupiah(item.price);
            const bundleDisc = Math.max(0, originalPrice - bundlePrice);
            appliedBundles.push({
                bundleId: item.id,
                bundleName: String(item.name || '').replace('🎁 ', ''),
                originalPrice,
                bundlePrice,
                discount: bundleDisc
            });

            subtotal += originalPrice;
        } else {
            const itemQty = Math.max(0, parseInt(item.qty, 10) || 0);
            const unitNetPrice = toIntRupiah(item.price);
            const unitDisc = toIntRupiah(item.discount || 0);
            qty += itemQty;
            subtotal += unitNetPrice * itemQty;
            if (unitDisc > 0) {
                totalItemDiscount += unitDisc * itemQty;
            }
        }
    });

    const bundleDiscount = appliedBundles.reduce((sum, b) => sum + toIntRupiah(b.discount), 0);
    const afterBundleTotal = Math.max(0, subtotal - bundleDiscount);
    const transactionDiscount = Math.min(afterBundleTotal, toIntRupiah(rawTransactionDiscount));
    const total = Math.max(0, afterBundleTotal - transactionDiscount);

    return {
        qty,
        subtotal,
        totalItemDiscount,
        bundleDiscount,
        transactionDiscount,
        total,
        appliedBundles,
        hasAnyDiscount: totalItemDiscount > 0 || bundleDiscount > 0 || transactionDiscount > 0
    };
};

export const applyDiscountPurgeToProducts = (productsList = []) => {
    let updatedProductsCount = 0;
    let updatedVariationsCount = 0;

    const nextProducts = productsList.map((prod) => {
        const baseDisc = toIntRupiah(prod.discount || 0);
        const hasBaseDisc = baseDisc > 0;
        let varChanged = false;

        const nextVariations = Array.isArray(prod.variations)
            ? prod.variations.map((v) => {
                if (toIntRupiah(v.discount || 0) > 0) {
                    updatedVariationsCount += 1;
                    varChanged = true;
                    return { ...v, discount: 0 };
                }
                return v;
            })
            : [];

        if (hasBaseDisc || varChanged) {
            updatedProductsCount += 1;
            return {
                ...prod,
                discount: 0,
                variations: nextVariations
            };
        }
        return prod;
    });

    return {
        nextProducts,
        updatedProductsCount,
        updatedVariationsCount
    };
};
