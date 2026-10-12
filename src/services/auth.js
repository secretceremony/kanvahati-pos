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
export const fetchUserRole = async (user) => {
    if (!user) return null;

    try {
        // 1. Check custom user claims
        const idTokenResult = await user.getIdTokenResult(true);
        if (idTokenResult.claims && idTokenResult.claims.role) {
            return idTokenResult.claims.role;
        }

        // 2. Fallback to server-controlled staff_roles collection
        const roleDocRef = doc(db, "staff_roles", user.uid);
        const roleDoc = await getDoc(roleDocRef);
        if (roleDoc.exists() && roleDoc.data().role) {
            return roleDoc.data().role;
        }
    } catch (e) {
        console.warn("Could not retrieve custom claims/role document:", e);
    }

    // Default authenticated staff role
    return 'cashier';
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
            const role = await fetchUserRole(user);
            callback({ user, role, isAuthenticated: true });
        } else {
            callback({ user: null, role: null, isAuthenticated: false });
        }
    });
};
