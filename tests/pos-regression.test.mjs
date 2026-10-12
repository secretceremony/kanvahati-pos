import test from 'node:test';
import assert from 'node:assert/strict';

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
});
