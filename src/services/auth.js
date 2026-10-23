// --- Kanvahati Unified Authentication Service ---
import { auth, db } from '../firebase';
import { 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

/**
 * Login user using Firebase Authentication.
 * Rejects with clear localized error messages.
 * No hardcoded credentials or fallbacks allowed.
 */
export const loginWithEmail = async (email, password) => {
    if (!email || !password) {
        throw new Error("Email dan password wajib diisi!");
    }

    const cleanEmail = email.trim();
    try {
        const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
        const user = userCredential.user;
        const role = await fetchUserRole(user);
        
        return { user, role };
    } catch (error) {
        // Map common Firebase Auth error codes to user-friendly messages
        let message = "Gagal masuk. Periksa kembali kredensial Anda.";
        switch (error.code) {
            case 'auth/invalid-credential':
            case 'auth/user-not-found':
            case 'auth/wrong-password':
                message = "Email atau password tidak valid!";
                break;
            case 'auth/invalid-email':
                message = "Format email tidak valid!";
                break;
            case 'auth/user-disabled':
                message = "Akun staf ini telah dinonaktifkan oleh administrator.";
                break;
            case 'auth/too-many-requests':
                message = "Terlalu banyak percobaan gagal. Silakan tunggu beberapa saat lagi.";
                break;
            case 'auth/network-request-failed':
                message = "Koneksi internet bermasalah. Periksa jaringan booth.";
                break;
            default:
                message = error.message || message;
        }
        const err = new Error(message);
        err.code = error.code;
        throw err;
    }
};

/**
 * Fetch role from Firebase Auth Custom Claims or staff_roles collection.
 * Default role is 'cashier' if authenticated but role unassigned.
 */
/**
 * Fetch role and user metadata from Firebase Auth Custom Claims or staff_roles collection.
 */
export const fetchUserData = async (user) => {
    if (!user) return { role: null, displayName: null };

    // Default designations lookup
    const SUPER_ADMIN_MAP = {
        "neptuniistars@gmail.com": "Tenma",
        "ansellmatita@gmail.com": "Sil"
    };

    const ADMIN_MAP = {
        "jun@kanvahati.internal": "Jun",
        "shu@kanvahati.internal": "Shu",
        "rara@kanvahati.internal": "Rara"
    };

    const ARCADE_HOST_MAP = {
        "host1@kanvahati.internal": "Arcade Host Alpha 🎮",
        "host2@kanvahati.internal": "Arcade Host Beta 🎲"
    };

    const emailKey = user.email ? user.email.toLowerCase() : "";

    let resolvedRole = null;
    let resolvedName = user.displayName || null;

    if (SUPER_ADMIN_MAP[emailKey]) {
        resolvedRole = 'super_admin';
        if (!resolvedName) resolvedName = SUPER_ADMIN_MAP[emailKey];
    } else if (ADMIN_MAP[emailKey]) {
        resolvedRole = 'admin';
        if (!resolvedName) resolvedName = ADMIN_MAP[emailKey];
    } else if (ARCADE_HOST_MAP[emailKey]) {
        resolvedRole = 'arcade_host';
        if (!resolvedName) resolvedName = ARCADE_HOST_MAP[emailKey];
    } else if (emailKey === "display@kanvahati.internal") {
        resolvedRole = 'arcade_display';
        if (!resolvedName) resolvedName = "Kiosk Display Station 01 📺";
    }

    try {
        // 1. Check custom user claims
        const idTokenResult = await user.getIdTokenResult(true);
        if (idTokenResult.claims && idTokenResult.claims.role) {
            resolvedRole = idTokenResult.claims.role;
        }

        // 2. Fetch from Firestore staff_roles collection (canonical source of truth)
        const roleDocRef = doc(db, "staff_roles", user.uid);
        const roleDoc = await getDoc(roleDocRef);
        if (roleDoc.exists()) {
            const data = roleDoc.data();
            if (data.role) resolvedRole = data.role;
            if (data.displayName) resolvedName = data.displayName;
        }
    } catch (e) {
        console.warn("Could not retrieve staff_roles document from Firestore:", e);
    }

    return {
        role: resolvedRole || 'cashier',
        displayName: resolvedName || (user.email ? user.email.split('@')[0] : 'User')
    };
};

export const fetchUserRole = async (user) => {
    const data = await fetchUserData(user);
    return data.role;
};

/**
 * Sign out current user.
 */
export const logoutUser = async () => {
    await signOut(auth);
};

/**
 * Subscribe to auth state changes.
 */
export const subscribeAuthState = (callback) => {
    return onAuthStateChanged(auth, async (user) => {
        if (user) {
            const { role, displayName } = await fetchUserData(user);
            callback({ user, role, displayName, isAuthenticated: true });
        } else {
            callback({ user: null, role: null, displayName: null, isAuthenticated: false });
        }
    });
};
