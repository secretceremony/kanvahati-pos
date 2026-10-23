/**
 * Kanvahati POS & Arcade — Trusted Server-Side Staff Role Provisioning
 * 
 * Usage:
 *   node scripts/set-staff-roles.mjs <serviceAccountKey.json>
 * 
 * This script sets Firebase Auth Custom Claims and updates the staff_roles
 * collection in Firestore for the designated 6 Kanvahati team members.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';

// Designated Kanvahati Team Accounts with Assigned Roles
export const DESIGNATED_STAFF = [
    {
        email: "neptuniistars@gmail.com",
        displayName: "Tenma",
        role: "super_admin",
        notes: "Super Admin: full system, user management, audit logs, delete transactions"
    },
    {
        email: "ansellmatita@gmail.com",
        displayName: "Sil",
        role: "super_admin",
        notes: "Super Admin: full system, user management, audit logs, delete transactions"
    },
    {
        email: "jun@kanvahati.internal",
        displayName: "Jun",
        role: "admin",
        notes: "Admin Kasir: POS, stock, promo, bundles, rekapan"
    },
    {
        email: "shu@kanvahati.internal",
        displayName: "Shu",
        role: "admin",
        notes: "Admin Kasir: POS, stock, promo, bundles, rekapan"
    },
    {
        email: "rara@kanvahati.internal",
        displayName: "Rara",
        role: "admin",
        notes: "Admin Kasir: POS, stock, promo, bundles, rekapan"
    },
    {
        email: "host1@kanvahati.internal",
        displayName: "Arcade Host Alpha 🎮",
        role: "arcade_host",
        notes: "Host Console, Secret Answers, Timer & Prize validation"
    },
    {
        email: "host2@kanvahati.internal",
        displayName: "Arcade Host Beta 🎲",
        role: "arcade_host",
        notes: "Host Console, Secret Answers, Timer & Prize validation"
    },
    {
        email: "display@kanvahati.internal",
        displayName: "Kiosk Display Station 01 📺",
        role: "arcade_display",
        notes: "Read-only access to assigned active arcade session"
    }
];

async function main() {
    const serviceAccountPath = process.argv[2] || process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (!serviceAccountPath || !existsSync(serviceAccountPath)) {
        console.log("ℹ️ Dry-run mode: No serviceAccountKey.json provided.");
        console.log("Daftar 6 Akun Resmi Tim Kanvahati yang Ditetapkan:");
        console.table(DESIGNATED_STAFF);
        console.log("\nUntuk mengeksekusi ke Firebase Production/Staging:");
        console.log("node scripts/set-staff-roles.mjs ./serviceAccountKey.json");
        return;
    }

    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    const app = initializeApp({
        credential: cert(serviceAccount)
    });
    const adminAuth = getAuth(app);
    const adminDb = getFirestore(app);

    console.log("🔐 Memulai sinkronisasi peran staf Kanvahati...");

    for (const staff of DESIGNATED_STAFF) {
        try {
            let user;
            try {
                user = await adminAuth.getUserByEmail(staff.email);
            } catch (err) {
                if (err.code === 'auth/user-not-found') {
                    console.log(`Creating user: ${staff.email}...`);
                    user = await adminAuth.createUser({
                        email: staff.email,
                        displayName: staff.displayName,
                        emailVerified: true
                    });
                } else {
                    throw err;
                }
            }

            // 1. Set Custom User Claims on Firebase Auth Token
            await adminAuth.setCustomUserClaims(user.uid, {
                role: staff.role
            });

            // 2. Set Firestore document in staff_roles
            await adminDb.collection("staff_roles").doc(user.uid).set({
                uid: user.uid,
                email: staff.email,
                displayName: staff.displayName,
                role: staff.role,
                updatedAt: new Date().toISOString(),
                assignedVia: "Admin SDK Trusted Bootstrap"
            }, { merge: true });

            console.log(`✅ [OK] ${staff.email} -> Role: ${staff.role}`);
        } catch (e) {
            console.error(`❌ Gagal menetapkan peran untuk ${staff.email}:`, e.message);
        }
    }

    console.log("\n🎉 Sinkronisasi seluruh peran staf selesai!");
}

if (process.argv[1] && process.argv[1].endsWith('set-staff-roles.mjs')) {
    main().catch(console.error);
}
