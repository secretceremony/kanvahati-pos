import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { 
    initializeTestEnvironment, 
    assertFails, 
    assertSucceeds 
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'kanvahati-test-sandbox';

test('Live Firestore Emulator Security Rules Unit Testing', async (t) => {
    const rulesContent = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');

    const testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {
            rules: rulesContent,
            host: '127.0.0.1',
            port: 8080
        }
    });

    await testEnv.clearFirestore();

    // Instantiate firestore instances ONCE per context
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    const adminDb = testEnv.authenticatedContext('admin_uid', { role: 'admin' }).firestore();
    const cashierDb = testEnv.authenticatedContext('cashier_uid', { role: 'cashier' }).firestore();
    const hostDb = testEnv.authenticatedContext('host_uid', { role: 'arcade_host' }).firestore();
    const displayDb = testEnv.authenticatedContext('display_uid', { role: 'arcade_display' }).firestore();
    const guestDb = testEnv.authenticatedContext('guest_uid', { role: 'guest' }).firestore();

    await t.test('1. Unauthenticated & Guest requests are completely rejected everywhere', async () => {
        await assertFails(getDoc(doc(unauthDb, 'products', 'PROD-01')));
        await assertFails(getDoc(doc(unauthDb, 'arcade_secrets', 'Q-01')));
        await assertFails(getDoc(doc(unauthDb, 'arcade_sessions', 'CF20_station-1')));

        await assertFails(getDoc(doc(guestDb, 'products', 'PROD-01')));
        await assertFails(getDoc(doc(guestDb, 'arcade_secrets', 'Q-01')));
        await assertFails(getDoc(doc(guestDb, 'arcade_participants', 'PART-01')));
    });

    await t.test('2. staff_roles collection has allow write: if false (client cannot modify roles)', async () => {
        // Even admin client cannot write directly to staff_roles (server-side Admin SDK only)
        await assertFails(setDoc(doc(cashierDb, 'staff_roles', 'cashier_uid'), { role: 'admin' }));
        await assertFails(setDoc(doc(adminDb, 'staff_roles', 'admin_uid'), { role: 'superadmin' }));
    });

    await t.test('3. POS collections: accessible by cashier & admin, DENIED for display & host', async () => {
        // Cashier can write and read products & transactions
        await assertSucceeds(setDoc(doc(cashierDb, 'products', 'STICKER-01'), {
            name: 'Miku Sticker',
            price: 25000,
            stock: 50
        }));
        await assertSucceeds(getDoc(doc(cashierDb, 'products', 'STICKER-01')));

        await assertSucceeds(setDoc(doc(cashierDb, 'transactions', 'TX-1001'), {
            total: 50000,
            cashier: 'Kasir Peach'
        }));
        await assertSucceeds(getDoc(doc(cashierDb, 'transactions', 'TX-1001')));

        // Display and Arcade Host CANNOT read or write POS data!
        await assertFails(getDoc(doc(displayDb, 'products', 'STICKER-01')));
        await assertFails(getDoc(doc(displayDb, 'transactions', 'TX-1001')));
        await assertFails(getDoc(doc(hostDb, 'transactions', 'TX-1001')));
    });

    await t.test('4. arcade_secrets: strictly accessible by host & admin, COMPLETELY BLOCKED for display', async () => {
        // Host writes a secret answer
        await assertSucceeds(setDoc(doc(hostDb, 'arcade_secrets', 'Q-G04-001'), {
            answerKey: 'Frieren: Beyond Journey\'s End',
            alternativeAnswers: ['Sousou no Frieren'],
            hostNotes: 'Crop adegan koper ajaib'
        }));

        // Host can read the secret answer
        await assertSucceeds(getDoc(doc(hostDb, 'arcade_secrets', 'Q-G04-001')));

        // DISPLAY DEVICE MUST BE DENIED! (Zero-trust document level separation)
        await assertFails(getDoc(doc(displayDb, 'arcade_secrets', 'Q-G04-001')));
        await assertFails(setDoc(doc(displayDb, 'arcade_secrets', 'Q-HACK'), { answerKey: 'Cheated' }));
    });

    await t.test('5. arcade_sessions: Display is READ-ONLY, Host is READ/WRITE', async () => {
        // Host starts a session
        await assertSucceeds(setDoc(doc(hostDb, 'arcade_sessions', 'CF20_station-1'), {
            eventId: 'CF20',
            stationId: 'station-1',
            status: 'playing',
            gameId: 'G04',
            displayPrompt: 'Tebak anime dari potongan gambar berikut!',
            timerDurationSec: 30
        }));

        // Display device can READ session state
        await assertSucceeds(getDoc(doc(displayDb, 'arcade_sessions', 'CF20_station-1')));

        // Display device CANNOT write or alter session state
        await assertFails(setDoc(doc(displayDb, 'arcade_sessions', 'CF20_station-1'), { status: 'won' }));
        await assertFails(updateDoc(doc(displayDb, 'arcade_sessions', 'CF20_station-1'), { status: 'won' }));
    });

    await t.test('6. arcade_participants: Host can create and update, Display cannot access', async () => {
        // Host records participant
        await assertSucceeds(setDoc(doc(hostDb, 'arcade_participants', 'CF20_hash123'), {
            eventId: 'CF20',
            displayName: 'Rina',
            result: 'win',
            sketchClaimed: false,
            stickerClaimed: true
        }));

        // Host updates prize claim
        await assertSucceeds(updateDoc(doc(hostDb, 'arcade_participants', 'CF20_hash123'), {
            sketchClaimed: true
        }));

        // Display CANNOT read participant PII or claim status
        await assertFails(getDoc(doc(displayDb, 'arcade_participants', 'CF20_hash123')));
    });

    // Cleanup environment
    await testEnv.cleanup();
});
