// --- Kanvahati Unified Audit Trail Service ---
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';

const LOCAL_AUDIT_LOGS_KEY = 'kanvahati_pos_local_audit_logs';

/**
 * Get locally cached audit logs
 */
const getLocalAuditLogs = () => {
    try {
        const stored = localStorage.getItem(LOCAL_AUDIT_LOGS_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
};

/**
 * Save audit log locally
 */
const saveLocalAuditLog = (logEntry) => {
    try {
        const current = getLocalAuditLogs();
        const updated = [logEntry, ...current].slice(0, 500); // retain last 500
        localStorage.setItem(LOCAL_AUDIT_LOGS_KEY, JSON.stringify(updated));
    } catch (e) {
        console.warn("Could not write local audit log:", e);
    }
};

/**
 * Record an audit log event
 * @param {Object} params
 * @param {string} params.action - e.g. 'ITEM_ADD', 'ITEM_UPDATE', 'PRICE_CHANGE', 'DISCOUNT_CHANGE', 'TRANSACTION_DELETE', 'ROLE_CHANGE'
 * @param {string} params.summary - Human-readable summary
 * @param {Object} params.actor - { uid, email, displayName, role }
 * @param {Object} [params.details] - Before/after or extra metadata
 */
export const recordAuditLog = async ({ action, summary, actor, details = {} }) => {
    const logEntry = {
        action,
        summary,
        actor: {
            uid: actor?.uid || 'system',
            email: actor?.email || 'unknown',
            displayName: actor?.displayName || actor?.name || 'Staff',
            role: actor?.role || 'cashier'
        },
        details,
        timestamp: new Date().toISOString()
    };

    // Save to local cache immediately
    saveLocalAuditLog(logEntry);

    // Save to Firestore audit_logs collection
    try {
        await addDoc(collection(db, "audit_logs"), logEntry);
    } catch (e) {
        console.warn("Firestore audit log write failed (offline fallback active):", e);
    }

    return logEntry;
};

/**
 * Fetch latest audit logs (Firestore first with local fallback)
 * @param {number} maxLogs
 */
export const fetchAuditLogs = async (maxLogs = 100) => {
    try {
        const q = query(collection(db, "audit_logs"), orderBy("timestamp", "desc"), limit(maxLogs));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            localStorage.setItem(LOCAL_AUDIT_LOGS_KEY, JSON.stringify(logs));
            return logs;
        }
    } catch (e) {
        console.warn("Firestore fetchAuditLogs failed, using local logs:", e);
    }
    return getLocalAuditLogs();
};
