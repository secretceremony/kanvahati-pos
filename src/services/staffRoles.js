// --- Staff Role Management Service ---
import { db, firebaseConfig } from '../firebase';
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { recordAuditLog } from './audit';

const LOCAL_STAFF_ROLES_KEY = 'kanvahati_pos_local_staff_roles';

/**
 * Register a user into Firebase Authentication directly using an isolated secondary app.
 * This prevents the current Super Admin session from being logged out!
 */
export const registerAuthUser = async (email, password) => {
    if (!password || password.length < 6) {
        throw new Error("Password minimal harus 6 karakter!");
    }

    // Initialize temporary secondary app instance
    const secondaryAppName = `kanvahati-auth-reg-${Date.now()}`;
    const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);

    try {
        const userCred = await createUserWithEmailAndPassword(secondaryAuth, email.trim().toLowerCase(), password);
        return userCred.user.uid;
    } catch (err) {
        if (err.code === 'auth/email-already-in-use') {
            console.log(`User ${email} already exists in Firebase Auth.`);
            return null; // already registered, can continue saving role
        }
        throw err;
    } finally {
        await deleteApp(secondaryApp);
    }
};

export const DEFAULT_DESIGNATED_STAFF = [
    {
        uid: "staff_neptuniistars_gmail_com",
        email: "neptuniistars@gmail.com",
        displayName: "Tenma",
        role: "super_admin"
    },
    {
        uid: "staff_ansellmatita_gmail_com",
        email: "ansellmatita@gmail.com",
        displayName: "Sil",
        role: "super_admin"
    },
    {
        uid: "staff_jun_kanvahati_internal",
        email: "jun@kanvahati.internal",
        displayName: "Jun",
        role: "admin"
    },
    {
        uid: "staff_shu_kanvahati_internal",
        email: "shu@kanvahati.internal",
        displayName: "Shu",
        role: "admin"
    },
    {
        uid: "staff_rara_kanvahati_internal",
        email: "rara@kanvahati.internal",
        displayName: "Rara",
        role: "admin"
    },
    {
        uid: "staff_host1_kanvahati_internal",
        email: "host1@kanvahati.internal",
        displayName: "Arcade Host Alpha 🎮",
        role: "arcade_host"
    },
    {
        uid: "staff_host2_kanvahati_internal",
        email: "host2@kanvahati.internal",
        displayName: "Arcade Host Beta 🎲",
        role: "arcade_host"
    },
    {
        uid: "staff_display_kanvahati_internal",
        email: "display@kanvahati.internal",
        displayName: "Kiosk Display Station 01 📺",
        role: "arcade_display"
    }
];

/**
 * Pre-seed all designated staff into Firestore staff_roles collection
 */
export const seedDesignatedStaff = async (actor = null) => {
    for (const staff of DEFAULT_DESIGNATED_STAFF) {
        try {
            await setDoc(doc(db, "staff_roles", staff.uid), {
                ...staff,
                updatedAt: new Date().toISOString(),
                assignedVia: "Super Admin Pre-seed"
            }, { merge: true });
        } catch (err) {
            console.warn(`Could not seed staff ${staff.email}:`, err);
        }
    }
};

/**
 * Fetch all staff roles (Auto pre-seed defaults if Firestore collection is empty)
 */
export const fetchAllStaffRoles = async (actor = null) => {
    try {
        const snapshot = await getDocs(collection(db, "staff_roles"));
        if (!snapshot.empty) {
            const list = snapshot.docs.map(d => ({ uid: d.id, ...d.data() }));
            
            // Check if any designated staff are missing; if so, sync them in
            const existingEmails = new Set(list.map(s => s.email?.toLowerCase()));
            const missingStaff = DEFAULT_DESIGNATED_STAFF.filter(s => !existingEmails.has(s.email.toLowerCase()));
            
            if (missingStaff.length > 0) {
                console.log(`Pre-seeding ${missingStaff.length} missing designated staff to Firestore...`);
                for (const staff of missingStaff) {
                    try {
                        await setDoc(doc(db, "staff_roles", staff.uid), {
                            ...staff,
                            updatedAt: new Date().toISOString(),
                            assignedVia: "Auto Pre-seed Sync"
                        }, { merge: true });
                        list.push(staff);
                    } catch (err) {
                        console.warn(`Could not seed missing staff ${staff.email}:`, err);
                    }
                }
            }

            localStorage.setItem(LOCAL_STAFF_ROLES_KEY, JSON.stringify(list));
            return list;
        }

        // Collection is empty: automatically pre-seed designated staff!
        console.log("Pre-seeding default designated staff roles to Firestore...");
        for (const staff of DEFAULT_DESIGNATED_STAFF) {
            try {
                await setDoc(doc(db, "staff_roles", staff.uid), {
                    ...staff,
                    updatedAt: new Date().toISOString(),
                    assignedVia: "Auto Pre-seed Initializer"
                }, { merge: true });
            } catch (err) {
                console.warn(`Could not write pre-seeded staff ${staff.email}:`, err);
            }
        }

        localStorage.setItem(LOCAL_STAFF_ROLES_KEY, JSON.stringify(DEFAULT_DESIGNATED_STAFF));
        return DEFAULT_DESIGNATED_STAFF;
    } catch (e) {
        console.warn("Firestore fetchAllStaffRoles failed, falling back to local/default:", e);
    }

    try {
        const stored = localStorage.getItem(LOCAL_STAFF_ROLES_KEY);
        return stored ? JSON.parse(stored) : DEFAULT_DESIGNATED_STAFF;
    } catch {
        return DEFAULT_DESIGNATED_STAFF;
    }
};

/**
 * Assign or update a staff role
 */
export const assignStaffRole = async ({ uid, email, displayName, role, actor }) => {
    const payload = {
        uid,
        email: email.trim().toLowerCase(),
        displayName: displayName || email.split('@')[0],
        role,
        updatedAt: new Date().toISOString(),
        updatedBy: actor?.email || 'super_admin'
    };

    try {
        await setDoc(doc(db, "staff_roles", uid), payload, { merge: true });
    } catch (e) {
        console.error("Firestore assignStaffRole failed:", e);
        throw e;
    }

    // Update local cache
    try {
        const stored = localStorage.getItem(LOCAL_STAFF_ROLES_KEY);
        const list = stored ? JSON.parse(stored) : [];
        const idx = list.findIndex(item => item.uid === uid);
        if (idx >= 0) {
            list[idx] = { ...list[idx], ...payload };
        } else {
            list.push(payload);
        }
        localStorage.setItem(LOCAL_STAFF_ROLES_KEY, JSON.stringify(list));
    } catch (err) {
        console.warn("Could not sync local staff roles cache:", err);
    }

    // Record audit log
    await recordAuditLog({
        action: 'ROLE_CHANGE',
        summary: `Peran untuk ${payload.displayName} (${payload.email}) diubah menjadi ${role}`,
        actor,
        details: { targetUid: uid, targetEmail: payload.email, newRole: role }
    });

    return payload;
};

/**
 * Remove a staff role assignment
 */
export const removeStaffRole = async (uid, staffEmail, actor) => {
    await deleteDoc(doc(db, "staff_roles", uid));

    // Update local cache
    try {
        const stored = localStorage.getItem(LOCAL_STAFF_ROLES_KEY);
        if (stored) {
            const list = JSON.parse(stored).filter(item => item.uid !== uid);
            localStorage.setItem(LOCAL_STAFF_ROLES_KEY, JSON.stringify(list));
        }
    } catch (err) {
        console.warn("Could not sync local staff roles cache:", err);
    }

    // Record audit log
    await recordAuditLog({
        action: 'ROLE_DELETE',
        summary: `Akses staf ${staffEmail} dicabut`,
        actor,
        details: { targetUid: uid, targetEmail: staffEmail }
    });
};
