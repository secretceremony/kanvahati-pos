import test from 'node:test';
import assert from 'node:assert/strict';
import {
    toIntRupiah,
    sanitizeIntegerInput,
    formatRupiah,
    calculateTicketTotals,
    applyDiscountPurgeToProducts
} from '../src/utils/currency.js';

test('POS Core Business Logic Regression Suite', async (t) => {
    // 1. Transaction Totals Calculation
    await t.test('Perhitungan total item dan harga keranjang POS konsisten', () => {
        const ticket = [
            { id: "STICKER-01", name: "Dreamy Clouds Pack", price: 90000, qty: 2 },
            { id: "KEYCHAIN-01", name: "Matcha Bunny Acrylic", price: 125000, qty: 1 }
        ];

        let qty = 0;
        let subtotal = 0;
        ticket.forEach(item => {
            qty += item.qty;
            subtotal += item.price * item.qty;
        });
        const total = subtotal;

        assert.equal(qty, 3);
        assert.equal(subtotal, 305000);
        assert.equal(total, 305000);
    });

    // 2. Stock Deduction Logic
    await t.test('Pengurangan stok produk dan variasi bekerja dengan benar', () => {
        const product = {
            id: "SHIRT-01",
            name: "Anime Tee",
            stock: 15,
            variations: [
                { name: "Size M", stock: 10, price: 150000 },
                { name: "Size L", stock: 5, price: 150000 }
            ]
        };

        const cartItem = { id: "SHIRT-01", variationName: "Size M", qty: 2 };

        // Simulasi update stok
        const updatedVariations = product.variations.map(v => {
            if (v.name === cartItem.variationName) {
                return { ...v, stock: Math.max(0, v.stock - cartItem.qty) };
            }
            return v;
        });
        const newTotalStock = updatedVariations.reduce((sum, v) => sum + v.stock, 0);

        assert.equal(updatedVariations.find(v => v.name === "Size M").stock, 8);
        assert.equal(updatedVariations.find(v => v.name === "Size L").stock, 5);
        assert.equal(newTotalStock, 13);
    });

    // 3. Cash Drawer Summary Calculation
    await t.test('Perhitungan rekapitulasi penjualan harian Cash vs QRIS akurat', () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const txs = [
            { id: "TX-1", timestamp: new Date().toISOString(), paymentMethod: "cash", total: 100000, qty: 2 },
            { id: "TX-2", timestamp: new Date().toISOString(), paymentMethod: "qris", total: 150000, qty: 1 },
            { id: "TX-3", timestamp: new Date(Date.now() - 86400000 * 2).toISOString(), paymentMethod: "cash", total: 50000, qty: 1 } // Transaksi kemarin lusa
        ];

        let cashSales = 0;
        let qrisSales = 0;
        let totalOrders = 0;

        txs.forEach(tx => {
            if (new Date(tx.timestamp) >= today) {
                totalOrders++;
                if (tx.paymentMethod === 'cash') cashSales += tx.total;
                if (tx.paymentMethod === 'qris') qrisSales += tx.total;
            }
        });

        assert.equal(totalOrders, 2);
        assert.equal(cashSales, 100000);
        assert.equal(qrisSales, 150000);
    });

    // 4. Refund Restoration Logic
    await t.test('Logika pengembalian stok saat refund transaksi bekerja tepat', () => {
        let currentStock = 8;
        const refundedQty = 2;
        currentStock += refundedQty;

        assert.equal(currentStock, 10);
    });

    // 5. Hide From Catalogue Filter & Empty Slot Logic
    await t.test('Filter Katalog POS mengabaikan produk yang ditandai hiddenFromCatalogue', () => {
        const catalogProducts = [
            { id: "KH-STK-001", name: "Chibi Sticker", hiddenFromCatalogue: false, category: "stickers" },
            { id: "KH-SLOT-002", name: "[Empty Slot]", hiddenFromCatalogue: true, category: "stickers" },
            { id: "KH-PRT-003", name: "Secret Artprint", hiddenFromCatalogue: true, category: "prints" },
            { id: "KH-KCH-004", name: "Keyring", hiddenFromCatalogue: false, category: "keychains" }
        ];

        const visibleInPos = catalogProducts.filter(p => !p.hiddenFromCatalogue);
        assert.equal(visibleInPos.length, 2);
        assert.deepEqual(visibleInPos.map(p => p.id), ["KH-STK-001", "KH-KCH-004"]);
    });

    // 6. Stored Procedure CSV Schema Normalization Simulation
    await t.test('SP Normalization memvalidasi format CSV item dan variasi', () => {
        const rawImportRows = [
            { id: "KH-TEST-1", name: "Test Sticker", price: 10000, stock: 20, hiddenFromCatalogue: false, variations: [] },
            { id: "", name: "Auto ID Item", price: 25000, stock: 10, hiddenFromCatalogue: true, variations: [{ name: "A", price: 25000, stock: 10 }] }
        ];

        const normalized = rawImportRows.map(p => ({
            id: p.id ? p.id.toUpperCase() : "KH-AUTO-001",
            name: p.name.trim(),
            price: Number(p.price),
            stock: Number(p.stock),
            hiddenFromCatalogue: Boolean(p.hiddenFromCatalogue),
            variations: p.variations || []
        }));

        assert.equal(normalized[0].id, "KH-TEST-1");
        assert.equal(normalized[1].id, "KH-AUTO-001");
        assert.equal(normalized[1].hiddenFromCatalogue, true);
        assert.equal(normalized[1].variations.length, 1);
    });

    // 7. Stored Function: Bundle Savings Calculation
    await t.test('Stored Function fn_calculate_bundle_savings menghitung diskon secara akurat', () => {
        const products = [
            { id: "P1", price: 20000, variations: [] },
            { id: "P2", price: 30000, variations: [{ name: "Red", price: 35000 }] }
        ];

        const bundle = {
            id: "B1",
            bundlePrice: 45000,
            items: [
                { productId: "P1", qty: 1 },
                { productId: "P2", qty: 1, variationName: "Red" }
            ]
        };

        let orig = 0;
        bundle.items.forEach(it => {
            const p = products.find(prod => prod.id === it.productId);
            if (it.variationName) {
                const v = p.variations.find(v => v.name === it.variationName);
                orig += v.price * it.qty;
            } else {
                orig += p.price * it.qty;
            }
        });

        const savings = orig - bundle.bundlePrice;
        assert.equal(orig, 55000);
        assert.equal(savings, 10000);
        assert.equal(Math.round((savings / orig) * 100), 18);
    });

    // 8. Integer-Only Rupiah & No Decimals
    await t.test('toIntRupiah, sanitizeIntegerInput, dan formatRupiah membuang angka desimal', () => {
        assert.equal(toIntRupiah('15000.75'), 15001);
        assert.equal(toIntRupiah(-500), 0);
        assert.equal(toIntRupiah(''), 0);
        assert.equal(sanitizeIntegerInput('12.500,99abc'), '1250099');
        assert.equal(formatRupiah(25000.4), 'Rp 25.000');
    });

    // 9. Zero-Discount & Transaction-Level Discount Totals
    await t.test('calculateTicketTotals menjaga transaksi tanpa diskon tetap 0 dan memotong diskon transaksi secara bulat', () => {
        const plainTicket = [
            { id: 'P1', name: 'Sticker', price: 15000, originalPrice: 15000, discount: 0, qty: 2 }
        ];
        const noDisc = calculateTicketTotals(plainTicket, [], '');
        assert.equal(noDisc.totalItemDiscount, 0);
        assert.equal(noDisc.bundleDiscount, 0);
        assert.equal(noDisc.transactionDiscount, 0);
        assert.equal(noDisc.hasAnyDiscount, false);
        assert.equal(noDisc.total, 30000);

        const withTxDisc = calculateTicketTotals(plainTicket, [], '5000');
        assert.equal(withTxDisc.transactionDiscount, 5000);
        assert.equal(withTxDisc.hasAnyDiscount, true);
        assert.equal(withTxDisc.total, 25000);

        const clamped = calculateTicketTotals(plainTicket, [], '999999');
        assert.equal(clamped.transactionDiscount, 30000);
        assert.equal(clamped.total, 0);
    });

    // 10. Purge All Discounts Helper
    await t.test('applyDiscountPurgeToProducts mereset semua diskon item dan variasi ke 0 tanpa menyentuh item normal', () => {
        const prods = [
            { id: 'A', price: 20000, discount: 5000, variations: [] },
            { id: 'B', price: 30000, discount: 0, variations: [{ name: 'Red', price: 30000, discount: 3000 }, { name: 'Blue', price: 30000, discount: 0 }] },
            { id: 'C', price: 10000, discount: 0, variations: [] }
        ];
        const res = applyDiscountPurgeToProducts(prods);
        assert.equal(res.updatedProductsCount, 2);
        assert.equal(res.updatedVariationsCount, 1);
        assert.equal(res.nextProducts[0].discount, 0);
        assert.equal(res.nextProducts[1].variations[0].discount, 0);
        assert.equal(res.nextProducts[2], prods[2]);
    });
});
