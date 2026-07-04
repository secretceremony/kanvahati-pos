// --- Unified Data Layer with In-Memory Caching (Firestore & LocalStorage Fallback) ---
import { db } from '../firebase';
import { collection, getDocs, setDoc, doc, deleteDoc, writeBatch, query, orderBy } from 'firebase/firestore';

// Initial Product Data (All natively in IDR Rupiah)
const initialProducts = [
    { id: "STICKER-01", name: "Dreamy Clouds Pack", price: 90000, category: "stickers", stock: 45, img: "assets/sticker_pack.png", tag: "BARU" },
    { id: "KEYCHAIN-01", name: "Matcha Bunny Acrylic", price: 125000, category: "keychains", stock: 20, img: "assets/bunny_keychain.png", tag: "TERLARIS" },
    { id: "PRINT-01", name: "Cozy Cat Cafe Print", price: 75000, category: "prints", stock: 5, img: "assets/cozy_cafe_print.png", tag: "" },
    { id: "STICKER-02", name: "Sleepy Neko Sheet", price: 65000, category: "stickers", stock: 32, img: "assets/sleepy_cat_stickers.png", tag: "" },
    { id: "GRIP-01", name: "Strawberry Phone Grip", price: 105000, category: "keychains", stock: 8, img: "assets/strawberry_kitty_grip.png", tag: "BARU" },
    { id: "PRINT-02", name: "Froggy Star Gazing", price: 75000, category: "prints", stock: 12, img: "assets/stargazer_print.png", tag: "TERLARIS" },
    { id: "WASHI-01", name: "Cute Polka Washi", price: 50000, category: "washi", stock: 50, img: "assets/sticker_pack.png", tag: "" },
    { id: "STICKER-03", name: "Chibi Peach Bunny", price: 30000, category: "stickers", stock: 80, img: "assets/mascot.png", tag: "" }
];

// Local Storage keys (Appended _idr to clear old cache)
const LOCAL_PRODS_KEY = 'kanvahati_pos_local_products_idr';
const LOCAL_TXS_KEY = 'kanvahati_pos_local_transactions_idr';
const LOCAL_CATS_KEY = 'kanvahati_pos_local_categories_idr';
const LOCAL_CASH_DRAWER_KEY = 'kanvahati_pos_local_cash_drawer_idr';
const defaultCategories = [];

// In-Memory Global Caches
let cacheProducts = null;
let cacheCategories = null;
let cacheTransactions = null;
let cacheCashDrawer = null;

const getLocalProducts = () => {
    const stored = localStorage.getItem(LOCAL_PRODS_KEY);
    if (stored) return JSON.parse(stored);
    localStorage.setItem(LOCAL_PRODS_KEY, JSON.stringify(initialProducts));
    return [...initialProducts];
};

const getLocalTransactions = () => {
    const stored = localStorage.getItem(LOCAL_TXS_KEY);
    return stored ? JSON.parse(stored) : [];
};

// Check if credentials are mock/missing
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const isFirebaseConfigured = projectId && projectId !== "mock-project-id" && projectId.trim() !== "";

export const isUsingFirebase = () => {
    return isFirebaseConfigured;
};

// System config updater to notify other clients of data changes
export const triggerDataUpdate = async () => {
    if (!isUsingFirebase()) return;
    try {
        await setDoc(doc(db, "system", "config"), { lastDataUpdate: Date.now() }, { merge: true });
    } catch (e) {
        console.error("Failed to trigger data update", e);
    }
};

// --- Custom Categories Management ---
export const getCategories = async (forceRefetch = false) => {
    if (cacheCategories && !forceRefetch) {
        return [...cacheCategories];
    }

    let cats = [];
    if (!isFirebaseConfigured) {
        const stored = localStorage.getItem(LOCAL_CATS_KEY);
        if (stored) cats = JSON.parse(stored);
        else {
            localStorage.setItem(LOCAL_CATS_KEY, JSON.stringify(defaultCategories));
            cats = [...defaultCategories];
        }
    } else {
        try {
            const querySnapshot = await getDocs(collection(db, "categories"));
            if (querySnapshot.empty) {
                console.log("🔥 Seeding categories collection in Firebase Firestore...");
                const batch = writeBatch(db);
                defaultCategories.forEach((cat) => {
                    const docRef = doc(db, "categories", cat);
                    batch.set(docRef, { name: cat });
                });
                await batch.commit();
                cats = [...defaultCategories];
            } else {
                querySnapshot.forEach(doc => {
                    const data = doc.data();
                    cats.push(data.name || doc.id);
                });
            }
        } catch (e) {
            console.warn("Firestore read categories failed, using local fallback.", e);
            const stored = localStorage.getItem(LOCAL_CATS_KEY);
            cats = stored ? JSON.parse(stored) : [...defaultCategories];
        }
    }

    cacheCategories = cats;
    return [...cacheCategories];
};

export const saveCategory = async (categoryName) => {
    const cleanCat = categoryName.trim().toLowerCase();
    if (!cleanCat) return;

    // Update in-memory cache first
    if (cacheCategories && !cacheCategories.includes(cleanCat)) {
        cacheCategories.push(cleanCat);
    }

    if (!isFirebaseConfigured) {
        const cats = await getCategories();
        if (!cats.includes(cleanCat)) {
            cats.push(cleanCat);
            localStorage.setItem(LOCAL_CATS_KEY, JSON.stringify(cats));
        }
        return cleanCat;
    }
    try {
        await setDoc(doc(db, "categories", cleanCat), { name: cleanCat });
        await triggerDataUpdate();
        return cleanCat;
    } catch (e) {
        console.error("Firestore write category failed. Saving locally.", e);
        const cats = await getCategories();
        if (!cats.includes(cleanCat)) {
            cats.push(cleanCat);
            localStorage.setItem(LOCAL_CATS_KEY, JSON.stringify(cats));
        }
        return cleanCat;
    }
};

export const deleteCategory = async (categoryName) => {
    const cleanCat = categoryName.trim().toLowerCase();

    // Update in-memory cache first
    if (cacheCategories) {
        cacheCategories = cacheCategories.filter(c => c !== cleanCat);
    }

    if (!isFirebaseConfigured) {
        const cats = await getCategories();
        const filtered = cats.filter(c => c !== cleanCat);
        localStorage.setItem(LOCAL_CATS_KEY, JSON.stringify(filtered));
        return true;
    }
    try {
        await deleteDoc(doc(db, "categories", cleanCat));
        await triggerDataUpdate();
        return true;
    } catch (e) {
        console.error("Firestore delete category failed. Deleting locally.", e);
        const cats = await getCategories();
        const filtered = cats.filter(c => c !== cleanCat);
        localStorage.setItem(LOCAL_CATS_KEY, JSON.stringify(filtered));
        return true;
    }
};

// Seed products to Firestore if empty
export const seedProductsIfEmpty = async () => {
    if (!isFirebaseConfigured) return;
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        if (querySnapshot.empty) {
            console.log("🔥 Seeding products collection in Firebase Firestore...");
            const batch = writeBatch(db);
            initialProducts.forEach((p) => {
                const docRef = doc(db, "products", p.id);
                batch.set(docRef, p);
            });
            await batch.commit();
        }
    } catch (e) {
        console.error("Firebase seeding failed. Falling back to local state.", e);
    }
};

// Get all products
export const getProducts = async (forceRefetch = false) => {
    if (cacheProducts && !forceRefetch) {
        return [...cacheProducts];
    }

    let prods = [];
    if (!isFirebaseConfigured) {
        prods = getLocalProducts();
    } else {
        try {
            const querySnapshot = await getDocs(collection(db, "products"));
            if (querySnapshot.empty) {
                await seedProductsIfEmpty();
                prods = [...initialProducts];
            } else {
                querySnapshot.forEach(doc => {
                    prods.push(doc.data());
                });
            }
        } catch (e) {
            console.warn("Firestore read products failed, using local fallback.", e);
            prods = getLocalProducts();
        }
    }

    cacheProducts = prods.sort((a, b) => a.name.localeCompare(b.name));
    return [...cacheProducts];
};

// Save product (Add or Update)
export const saveProduct = async (product) => {
    const cleanProduct = {
        id: product.id.trim().toUpperCase(),
        name: product.name.trim(),
        price: parseFloat(product.price || 0),
        discount: parseFloat(product.discount || 0),
        category: product.category || 'stickers',
        stock: parseInt(product.stock || 0),
        img: product.img || 'assets/mascot.png',
        tag: product.tag || '',
        variations: product.variations || []
    };

    // Update in-memory cache first
    if (cacheProducts) {
        const existingIdx = cacheProducts.findIndex(p => p.id === cleanProduct.id);
        if (existingIdx > -1) {
            cacheProducts[existingIdx] = cleanProduct;
        } else {
            cacheProducts.push(cleanProduct);
            cacheProducts.sort((a, b) => a.name.localeCompare(b.name));
        }
    }

    if (!isFirebaseConfigured) {
        const localProds = getLocalProducts();
        const existingIdx = localProds.findIndex(p => p.id === cleanProduct.id);
        if (existingIdx > -1) {
            localProds[existingIdx] = cleanProduct;
        } else {
            localProds.push(cleanProduct);
        }
        localStorage.setItem(LOCAL_PRODS_KEY, JSON.stringify(localProds));
        return cleanProduct;
    }

    try {
        await setDoc(doc(db, "products", cleanProduct.id), cleanProduct);
        await triggerDataUpdate();
        return cleanProduct;
    } catch (e) {
        console.error("Firestore write product failed. Saving locally.", e);
        const localProds = getLocalProducts();
        const existingIdx = localProds.findIndex(p => p.id === cleanProduct.id);
        if (existingIdx > -1) {
            localProds[existingIdx] = cleanProduct;
        } else {
            localProds.push(cleanProduct);
        }
        localStorage.setItem(LOCAL_PRODS_KEY, JSON.stringify(localProds));
        return cleanProduct;
    }
};

// Delete product
export const deleteProduct = async (productId) => {
    // Check if product is in any active bundle and deactivate it
    const bundles = await getBundles();
    for (const bundle of bundles) {
        if (bundle.isActive && bundle.items.some(item => item.productId === productId)) {
            console.warn(`Deactivating bundle ${bundle.name} because product ${productId} was deleted.`);
            bundle.isActive = false;
            await saveBundle(bundle);
        }
    }

    // Update in-memory cache first
    if (cacheProducts) {
        cacheProducts = cacheProducts.filter(p => p.id !== productId);
    }

    if (!isFirebaseConfigured) {
        const localProds = getLocalProducts();
        const filtered = localProds.filter(p => p.id !== productId);
        localStorage.setItem(LOCAL_PRODS_KEY, JSON.stringify(filtered));
        return true;
    }

    try {
        await deleteDoc(doc(db, "products", productId));
        await triggerDataUpdate();
        return true;
    } catch (e) {
        console.error("Firestore delete product failed. Deleting locally.", e);
        const localProds = getLocalProducts();
        const filtered = localProds.filter(p => p.id !== productId);
        localStorage.setItem(LOCAL_PRODS_KEY, JSON.stringify(filtered));
        return true;
    }
};

// Bulk Delete products
export const deleteProductsBulk = async (productIds) => {
    if (!productIds || productIds.length === 0) return true;

    // Check if products are in any active bundle and deactivate them
    const bundles = await getBundles();
    for (const bundle of bundles) {
        if (bundle.isActive && bundle.items.some(item => productIds.includes(item.productId))) {
            console.warn(`Deactivating bundle ${bundle.name} because a containing product was bulk deleted.`);
            bundle.isActive = false;
            await saveBundle(bundle);
        }
    }

    // Update in-memory cache first
    if (cacheProducts) {
        cacheProducts = cacheProducts.filter(p => !productIds.includes(p.id));
    }

    if (!isFirebaseConfigured) {
        const localProds = getLocalProducts();
        const filtered = localProds.filter(p => !productIds.includes(p.id));
        localStorage.setItem(LOCAL_PRODS_KEY, JSON.stringify(filtered));
        return true;
    }

    try {
        const batch = writeBatch(db);
        productIds.forEach((id) => {
            batch.delete(doc(db, "products", id));
        });
        await batch.commit();
        await triggerDataUpdate();
        return true;
    } catch (e) {
        console.error("Firestore bulk delete failed. Deleting locally.", e);
        const localProds = getLocalProducts();
        const filtered = localProds.filter(p => !productIds.includes(p.id));
        localStorage.setItem(LOCAL_PRODS_KEY, JSON.stringify(filtered));
        return true;
    }
};

// Update stock count (Refill - supports optional variation selection)
export const updateProductStock = async (productId, newStock, variationName = null) => {
    // Update in-memory cache first
    if (cacheProducts) {
        const prod = cacheProducts.find(p => p.id === productId);
        if (prod) {
            if (variationName && prod.variations && prod.variations.length > 0) {
                const variation = prod.variations.find(v => v.name === variationName);
                if (variation) {
                    variation.stock = newStock;
                }
                prod.stock = prod.variations.reduce((sum, v) => sum + v.stock, 0);
            } else {
                prod.stock = newStock;
            }
        }
    }

    if (!isFirebaseConfigured) {
        const localProds = getLocalProducts();
        const product = localProds.find(p => p.id === productId);
        if (product) {
            if (variationName && product.variations && product.variations.length > 0) {
                const variation = product.variations.find(v => v.name === variationName);
                if (variation) {
                    variation.stock = newStock;
                }
                product.stock = product.variations.reduce((sum, v) => sum + v.stock, 0);
            } else {
                product.stock = newStock;
            }
            localStorage.setItem(LOCAL_PRODS_KEY, JSON.stringify(localProds));
            return product;
        }
        return null;
    }

    try {
        const prodsList = await getProducts();
        const product = prodsList.find(p => p.id === productId);
        if (product) {
            if (variationName && product.variations && product.variations.length > 0) {
                const variations = product.variations.map(v => {
                    if (v.name === variationName) {
                        return { ...v, stock: newStock };
                    }
                    return v;
                });
                const totalStock = variations.reduce((sum, v) => sum + v.stock, 0);
                const updated = { ...product, variations, stock: totalStock };
                await setDoc(doc(db, "products", productId), updated);
                return updated;
            } else {
                product.stock = newStock;
                await setDoc(doc(db, "products", productId), product);
                return product;
            }
        }
        return null;
    } catch (e) {
        console.error("Firestore stock update failed. Updating locally.", e);
        const localProds = getLocalProducts();
        const product = localProds.find(p => p.id === productId);
        if (product) {
            if (variationName && product.variations && product.variations.length > 0) {
                const variation = product.variations.find(v => v.name === variationName);
                if (variation) {
                    variation.stock = newStock;
                }
                product.stock = product.variations.reduce((sum, v) => sum + v.stock, 0);
            } else {
                product.stock = newStock;
            }
            localStorage.setItem(LOCAL_PRODS_KEY, JSON.stringify(localProds));
            return product;
        }
        return null;
    }
};

// Get all transactions
export const getTransactionsList = async (forceRefetch = false) => {
    if (cacheTransactions && !forceRefetch) {
        return [...cacheTransactions];
    }

    let txs = [];
    if (!isFirebaseConfigured) {
        txs = getLocalTransactions();
    } else {
        try {
            const q = query(collection(db, "transactions"), orderBy("timestamp", "desc"));
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach(doc => {
                txs.push(doc.data());
            });
        } catch (e) {
            console.warn("Firestore read transactions failed, using local fallback.", e);
            txs = getLocalTransactions();
        }
    }

    cacheTransactions = txs;
    return [...cacheTransactions];
};

// Save a new transaction (decrements variation stock if matching)
export const saveTransaction = async (items, totals, paymentMethod, cashier, appliedBundles = []) => {
    const txId = "TX-" + Math.floor(100000 + Math.random() * 900000);
    const newTx = {
        id: txId,
        timestamp: new Date().toISOString(),
        items: items.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            originalPrice: item.originalPrice || item.price,
            discount: item.discount || 0,
            qty: item.qty,
            variationName: item.variationName || null,
            fromBundle: item.fromBundle || null
        })),
        appliedBundles: appliedBundles,
        qty: totals.qty,
        subtotal: totals.subtotal,
        total: totals.total,
        paymentMethod: paymentMethod,
        cashier: cashier || "Kasir Peach 🌸"
    };

    // Update in-memory product stock cache directly!
    if (cacheProducts) {
        items.forEach(item => {
            const prod = cacheProducts.find(p => p.id === item.id);
            if (prod) {
                if (item.variationName && prod.variations && prod.variations.length > 0) {
                    const variation = prod.variations.find(v => v.name === item.variationName);
                    if (variation) {
                        variation.stock = Math.max(0, variation.stock - item.qty);
                    }
                    prod.stock = prod.variations.reduce((sum, v) => sum + v.stock, 0);
                } else {
                    prod.stock = Math.max(0, prod.stock - item.qty);
                }
            }
        });
    }

    // Append to transactions list in-memory cache directly!
    if (cacheTransactions) {
        cacheTransactions.unshift(newTx);
    } else {
        cacheTransactions = [newTx];
    }

    if (!isFirebaseConfigured) {
        const localProds = getLocalProducts();
        // Subtract stock counts
        items.forEach(item => {
            const prod = localProds.find(p => p.id === item.id);
            if (prod) {
                if (item.variationName && prod.variations && prod.variations.length > 0) {
                    const variation = prod.variations.find(v => v.name === item.variationName);
                    if (variation) {
                        variation.stock = Math.max(0, variation.stock - item.qty);
                    }
                    prod.stock = prod.variations.reduce((sum, v) => sum + v.stock, 0);
                } else {
                    prod.stock = Math.max(0, prod.stock - item.qty);
                }
            }
        });
        localStorage.setItem(LOCAL_PRODS_KEY, JSON.stringify(localProds));

        const localTxs = getLocalTransactions();
        localTxs.unshift(newTx);
        localStorage.setItem(LOCAL_TXS_KEY, JSON.stringify(localTxs));
        return newTx;
    }

    try {
        await setDoc(doc(db, "transactions", txId), newTx);
        
        // Decrement product stock in Firestore
        for (const item of items) {
            const docRef = doc(db, "products", item.id);
            const prodsList = await getProducts();
            const original = prodsList.find(p => p.id === item.id);
            if (original) {
                if (item.variationName && original.variations && original.variations.length > 0) {
                    const variations = original.variations.map(v => {
                        if (v.name === item.variationName) {
                            return { ...v, stock: Math.max(0, v.stock - item.qty) };
                        }
                        return v;
                    });
                    const newStock = variations.reduce((sum, v) => sum + v.stock, 0);
                    await setDoc(docRef, { ...original, variations, stock: newStock });
                } else {
                    const newStock = Math.max(0, original.stock - item.qty);
                    await setDoc(docRef, { ...original, stock: newStock });
                }
            }
        }
        return newTx;
    } catch (e) {
        console.error("Firestore write transaction failed. Writing to LocalStorage fallback.", e);
        const localProds = getLocalProducts();
        items.forEach(item => {
            const prod = localProds.find(p => p.id === item.id);
            if (prod) {
                if (item.variationName && prod.variations && prod.variations.length > 0) {
                    const variation = prod.variations.find(v => v.name === item.variationName);
                    if (variation) {
                        variation.stock = Math.max(0, variation.stock - item.qty);
                    }
                    prod.stock = prod.variations.reduce((sum, v) => sum + v.stock, 0);
                } else {
                    prod.stock = Math.max(0, prod.stock - item.qty);
                }
            }
        });
        localStorage.setItem(LOCAL_PRODS_KEY, JSON.stringify(localProds));

        const localTxs = getLocalTransactions();
        localTxs.unshift(newTx);
        localStorage.setItem(LOCAL_TXS_KEY, JSON.stringify(localTxs));
        return newTx;
    }
};

// Fetch sales stats
export const fetchSalesStats = async () => {
    const txs = await getTransactionsList();
    const prods = await getProducts();

    let totalRevenue = 0;
    let totalItemsSold = 0;
    const totalOrders = txs.length;

    const categorySales = {
        stickers: 0,
        keychains: 0,
        prints: 0,
        washi: 0
    };

    txs.forEach(tx => {
        totalRevenue += tx.total;
        totalItemsSold += tx.qty;

        tx.items.forEach(item => {
            const originalProduct = prods.find(p => p.id === item.id);
            const category = originalProduct ? originalProduct.category : 'stickers';
            if (categorySales[category] !== undefined) {
                categorySales[category] += item.qty;
            }
        });
    });

    return {
        totalRevenue,
        totalItemsSold,
        totalOrders,
        categorySales
    };
};

// Delete a transaction and refund product stocks
export const deleteTransactionAndRefund = async (transactionId) => {
    // 1. Find the transaction
    const txsList = await getTransactionsList();
    const transaction = txsList.find(tx => tx.id === transactionId);
    if (!transaction) return false;

    const itemsToRefund = transaction.items || [];

    // 2. Refund the product stocks in-memory cache first
    if (cacheProducts) {
        itemsToRefund.forEach(item => {
            const prod = cacheProducts.find(p => p.id === item.id);
            if (prod) {
                if (item.variationName && prod.variations && prod.variations.length > 0) {
                    const variation = prod.variations.find(v => v.name === item.variationName);
                    if (variation) {
                        variation.stock = (variation.stock || 0) + item.qty;
                    }
                    prod.stock = prod.variations.reduce((sum, v) => sum + (v.stock || 0), 0);
                } else {
                    prod.stock = (prod.stock || 0) + item.qty;
                }
            }
        });
    }

    // Remove from in-memory transaction cache
    if (cacheTransactions) {
        cacheTransactions = cacheTransactions.filter(tx => tx.id !== transactionId);
    }

    // 3. LocalStorage Refund and Deletion
    if (!isFirebaseConfigured) {
        const localProds = getLocalProducts();
        itemsToRefund.forEach(item => {
            const prod = localProds.find(p => p.id === item.id);
            if (prod) {
                if (item.variationName && prod.variations && prod.variations.length > 0) {
                    const variation = prod.variations.find(v => v.name === item.variationName);
                    if (variation) {
                        variation.stock = (variation.stock || 0) + item.qty;
                    }
                    prod.stock = prod.variations.reduce((sum, v) => sum + (v.stock || 0), 0);
                } else {
                    prod.stock = (prod.stock || 0) + item.qty;
                }
            }
        });
        localStorage.setItem(LOCAL_PRODS_KEY, JSON.stringify(localProds));

        const localTxs = getLocalTransactions();
        const filteredTxs = localTxs.filter(tx => tx.id !== transactionId);
        localStorage.setItem(LOCAL_TXS_KEY, JSON.stringify(filteredTxs));
        return true;
    }

    // 4. Firestore Refund and Deletion
    try {
        // Delete transaction document
        await deleteDoc(doc(db, "transactions", transactionId));

        // Restore stocks in Firestore
        for (const item of itemsToRefund) {
            const docRef = doc(db, "products", item.id);
            const prodsList = await getProducts();
            const original = prodsList.find(p => p.id === item.id);
            if (original) {
                if (item.variationName && original.variations && original.variations.length > 0) {
                    const variations = original.variations.map(v => {
                        if (v.name === item.variationName) {
                            return { ...v, stock: (v.stock || 0) + item.qty };
                        }
                        return v;
                    });
                    const newStock = variations.reduce((sum, v) => sum + (v.stock || 0), 0);
                    await setDoc(docRef, { ...original, variations, stock: newStock });
                } else {
                    const newStock = (original.stock || 0) + item.qty;
                    await setDoc(docRef, { ...original, stock: newStock });
                }
            }
        }
        return true;
    } catch (e) {
        console.error("Firestore refund/delete failed, executing locally.", e);
        const localProds = getLocalProducts();
        itemsToRefund.forEach(item => {
            const prod = localProds.find(p => p.id === item.id);
            if (prod) {
                if (item.variationName && prod.variations && prod.variations.length > 0) {
                    const variation = prod.variations.find(v => v.name === item.variationName);
                    if (variation) {
                        variation.stock = (variation.stock || 0) + item.qty;
                    }
                    prod.stock = prod.variations.reduce((sum, v) => sum + (v.stock || 0), 0);
                } else {
                    prod.stock = (prod.stock || 0) + item.qty;
                }
            }
        });
        localStorage.setItem(LOCAL_PRODS_KEY, JSON.stringify(localProds));

        const localTxs = getLocalTransactions();
        const filteredTxs = localTxs.filter(tx => tx.id !== transactionId);
        localStorage.setItem(LOCAL_TXS_KEY, JSON.stringify(filteredTxs));
        return true;
    }
};

// --- Cash Drawer Management ---
export const getCashDrawerEntries = async (forceRefetch = false) => {
    if (cacheCashDrawer && !forceRefetch) {
        return [...cacheCashDrawer];
    }

    let entries = [];
    if (!isFirebaseConfigured) {
        const stored = localStorage.getItem(LOCAL_CASH_DRAWER_KEY);
        entries = stored ? JSON.parse(stored) : [];
    } else {
        try {
            const q = query(collection(db, "cash_drawer"), orderBy("timestamp", "desc"));
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach(doc => {
                entries.push(doc.data());
            });
        } catch (e) {
            console.warn("Firestore read cash drawer failed, using local fallback.", e);
            const stored = localStorage.getItem(LOCAL_CASH_DRAWER_KEY);
            entries = stored ? JSON.parse(stored) : [];
        }
    }

    // Sort by timestamp descending just to be safe
    cacheCashDrawer = entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return [...cacheCashDrawer];
};

export const addCashDrawerEntry = async (type, amount, note, cashier) => {
    const entryId = "CD-" + Math.floor(100000 + Math.random() * 900000);
    const newEntry = {
        id: entryId,
        timestamp: new Date().toISOString(),
        type, // 'starting_cash' | 'cash_in' | 'cash_out'
        amount: parseFloat(amount || 0),
        note: note ? note.trim() : "",
        cashier: cashier || "Kasir Peach 🌸"
    };

    if (cacheCashDrawer) {
        cacheCashDrawer.unshift(newEntry);
    } else {
        cacheCashDrawer = [newEntry];
    }

    if (!isFirebaseConfigured) {
        const entries = await getCashDrawerEntries();
        entries.unshift(newEntry);
        localStorage.setItem(LOCAL_CASH_DRAWER_KEY, JSON.stringify(entries));
        return newEntry;
    }

    try {
        await setDoc(doc(db, "cash_drawer", entryId), newEntry);
        return newEntry;
    } catch (e) {
        console.error("Firestore write cash drawer entry failed. Saving locally.", e);
        const entries = await getCashDrawerEntries();
        entries.unshift(newEntry);
        localStorage.setItem(LOCAL_CASH_DRAWER_KEY, JSON.stringify(entries));
        return newEntry;
    }
};

export const updateCategoryName = async (oldName, newName) => {
    const cleanOld = oldName.trim().toLowerCase();
    const cleanNew = newName.trim().toLowerCase();
    if (!cleanOld || !cleanNew || cleanOld === cleanNew) return false;

    // 1. Update in-memory cache
    if (cacheCategories) {
        const idx = cacheCategories.indexOf(cleanOld);
        if (idx > -1) {
            cacheCategories[idx] = cleanNew;
        }
    }

    // Update products category in-memory cache
    if (cacheProducts) {
        cacheProducts.forEach(p => {
            if (p.category === cleanOld) {
                p.category = cleanNew;
            }
        });
    }

    // 2. LocalStorage update
    if (!isFirebaseConfigured) {
        const storedCats = localStorage.getItem(LOCAL_CATS_KEY);
        if (storedCats) {
            const cats = JSON.parse(storedCats);
            const idx = cats.indexOf(cleanOld);
            if (idx > -1) {
                cats[idx] = cleanNew;
                localStorage.setItem(LOCAL_CATS_KEY, JSON.stringify(cats));
            }
        }

        const storedProds = localStorage.getItem(LOCAL_PRODS_KEY);
        if (storedProds) {
            const prods = JSON.parse(storedProds);
            prods.forEach(p => {
                if (p.category === cleanOld) {
                    p.category = cleanNew;
                }
            });
            localStorage.setItem(LOCAL_PRODS_KEY, JSON.stringify(prods));
        }
        return true;
    }

    // 3. Firestore update
    try {
        // Delete old category doc, create new category doc
        await deleteDoc(doc(db, "categories", cleanOld));
        await setDoc(doc(db, "categories", cleanNew), { name: cleanNew });

        // Find all products with cleanOld category and update them
        const querySnapshot = await getDocs(collection(db, "products"));
        const batch = writeBatch(db);
        let hasUpdates = false;
        querySnapshot.forEach(docSnap => {
            const p = docSnap.data();
            if (p.category === cleanOld) {
                const docRef = doc(db, "products", p.id);
                batch.update(docRef, { category: cleanNew });
                hasUpdates = true;
            }
        });
        if (hasUpdates) {
            await batch.commit();
        }
        return true;
    } catch (e) {
        console.error("Firestore update category failed, falling back locally.", e);
        // Fallback to local storage update
        const storedCats = localStorage.getItem(LOCAL_CATS_KEY);
        if (storedCats) {
            const cats = JSON.parse(storedCats);
            const idx = cats.indexOf(cleanOld);
            if (idx > -1) {
                cats[idx] = cleanNew;
                localStorage.setItem(LOCAL_CATS_KEY, JSON.stringify(cats));
            }
        }

        const storedProds = localStorage.getItem(LOCAL_PRODS_KEY);
        if (storedProds) {
            const prods = JSON.parse(storedProds);
            prods.forEach(p => {
                if (p.category === cleanOld) {
                    p.category = cleanNew;
                }
            });
            localStorage.setItem(LOCAL_PRODS_KEY, JSON.stringify(prods));
        }
        return true;
    }
};

// --- BUNDLES MANAGEMENT ---

const LOCAL_BUNDLES_KEY = 'kanvahati_pos_local_bundles_idr';
let cacheBundles = null;

const getLocalBundles = () => {
    const stored = localStorage.getItem(LOCAL_BUNDLES_KEY);
    return stored ? JSON.parse(stored) : [];
};

export const getBundles = async (forceRefetch = false) => {
    if (cacheBundles && !forceRefetch) {
        return [...cacheBundles];
    }

    let bundles = [];
    if (!isFirebaseConfigured) {
        bundles = getLocalBundles();
    } else {
        try {
            const querySnapshot = await getDocs(collection(db, "bundles"));
            querySnapshot.forEach(doc => {
                bundles.push(doc.data());
            });
        } catch (e) {
            console.warn("Firestore read bundles failed, using local fallback.", e);
            bundles = getLocalBundles();
        }
    }

    cacheBundles = bundles;
    return [...cacheBundles];
};

export const saveBundle = async (bundle) => {
    const cleanBundle = {
        id: bundle.id || "BDL-" + Math.floor(100000 + Math.random() * 900000),
        name: bundle.name.trim(),
        items: bundle.items.map(item => ({
            productId: item.productId,
            variationName: item.variationName || null,
            qty: parseInt(item.qty || 1)
        })),
        bundlePrice: parseFloat(bundle.bundlePrice || 0),
        isActive: bundle.isActive !== undefined ? bundle.isActive : true,
        createdAt: bundle.createdAt || new Date().toISOString()
    };

    if (cacheBundles) {
        const existingIdx = cacheBundles.findIndex(b => b.id === cleanBundle.id);
        if (existingIdx > -1) cacheBundles[existingIdx] = cleanBundle;
        else cacheBundles.push(cleanBundle);
    }

    if (!isFirebaseConfigured) {
        const localBundles = getLocalBundles();
        const existingIdx = localBundles.findIndex(b => b.id === cleanBundle.id);
        if (existingIdx > -1) localBundles[existingIdx] = cleanBundle;
        else localBundles.push(cleanBundle);
        localStorage.setItem(LOCAL_BUNDLES_KEY, JSON.stringify(localBundles));
        return cleanBundle;
    }

    try {
        await setDoc(doc(db, "bundles", cleanBundle.id), cleanBundle);
        await triggerDataUpdate();
        return cleanBundle;
    } catch (e) {
        console.error("Firestore write bundle failed. Saving locally.", e);
        const localBundles = getLocalBundles();
        const existingIdx = localBundles.findIndex(b => b.id === cleanBundle.id);
        if (existingIdx > -1) localBundles[existingIdx] = cleanBundle;
        else localBundles.push(cleanBundle);
        localStorage.setItem(LOCAL_BUNDLES_KEY, JSON.stringify(localBundles));
        return cleanBundle;
    }
};

export const deleteBundle = async (bundleId) => {
    if (cacheBundles) {
        cacheBundles = cacheBundles.filter(b => b.id !== bundleId);
    }

    if (!isFirebaseConfigured) {
        const localBundles = getLocalBundles();
        const filtered = localBundles.filter(b => b.id !== bundleId);
        localStorage.setItem(LOCAL_BUNDLES_KEY, JSON.stringify(filtered));
        return true;
    }

    try {
        await deleteDoc(doc(db, "bundles", bundleId));
        await triggerDataUpdate();
        return true;
    } catch (e) {
        console.error("Firestore delete bundle failed. Deleting locally.", e);
        const localBundles = getLocalBundles();
        const filtered = localBundles.filter(b => b.id !== bundleId);
        localStorage.setItem(LOCAL_BUNDLES_KEY, JSON.stringify(filtered));
        return true;
    }
};
