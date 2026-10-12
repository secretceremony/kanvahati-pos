import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Security Rules Matrix Verification', async (t) => {
    const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
    assert.ok(fs.existsSync(rulesPath), 'firestore.rules harus tersedia');
    const rulesContent = fs.readFileSync(rulesPath, 'utf8');

    await t.test('1. Pastikan domain @itk.ac.id tidak digunakan sebagai basis izin', () => {
        assert.ok(
            !rulesContent.includes('@itk.ac.id') && !rulesContent.includes('@itk\\.ac\\.id'),
            'Domain email ITK tidak boleh ada di firestore.rules!'
        );
    });

    await t.test('2. Pastikan public open read/write dilarang', () => {
        assert.ok(
            !rulesContent.includes('allow read, write: if true;'),
            'Public read/write dilarang keras!'
        );
    });

    await t.test('3. Pastikan staff_roles write-protected dari client', () => {
        const staffRolesMatch = rulesContent.match(/match \/staff_roles\/\{userId\}[\s\S]*?allow write:\s*if\s*false;/);
        assert.ok(staffRolesMatch, 'staff_roles harus memiliki allow write: if false;');
    });

    await t.test('4. Pastikan arcade_secrets terpisah dan tidak dapat dibaca oleh Display', () => {
        const secretsMatch = rulesContent.match(/match \/arcade_secrets\/\{secretId\}[\s\S]*?allow read, write:\s*if\s*isArcadeHost\(\);/);
        assert.ok(secretsMatch, 'arcade_secrets harus hanya dapat dibaca oleh isArcadeHost()');
        assert.ok(!rulesContent.includes('isDisplay()') || !secretsMatch[0].includes('isDisplay()'), 'Display tidak boleh memiliki akses ke arcade_secrets');
    });

    await t.test('5. Pastikan arcade_sessions mengizinkan read untuk isDisplay() dan write untuk isArcadeHost()', () => {
        const sessionsMatch = rulesContent.match(/match \/arcade_sessions\/\{stationKey\}[\s\S]*?allow read:\s*if\s*isDisplay\(\);[\s\S]*?allow write:\s*if\s*isArcadeHost\(\);/);
        assert.ok(sessionsMatch, 'arcade_sessions harus mengizinkan read untuk Display dan write untuk Host');
    });

    await t.test('6. Pastikan seluruh koleksi POS membutuhkan peran isCashier()', () => {
        assert.ok(rulesContent.includes('match /products/{productId}'));
        assert.ok(rulesContent.includes('match /transactions/{txId}'));
        assert.ok(rulesContent.includes('match /cash_drawer/{drawerId}'));
        assert.ok(rulesContent.includes('allow read: if isCashier();'));
        assert.ok(rulesContent.includes('allow write: if isCashier();'));
    });
});

test('RBAC Logic Emulation Test', async (t) => {
    // Simulator fungsi getRole dan RBAC
    function simulateAccess(auth, path, operation) {
        if (!auth) return false;
        const role = auth.token?.role || null;
        const isAdmin = role === 'admin';
        const isCashier = role === 'cashier' || isAdmin;
        const isArcadeHost = role === 'arcade_host' || isAdmin;
        const isDisplay = role === 'arcade_display' || isArcadeHost;

        if (path.startsWith('staff_roles/')) {
            if (operation === 'write') return false; // write always false
            return isAdmin || (auth.uid === path.split('/')[1]);
        }
        if (path.startsWith('products/') || path.startsWith('transactions/') || path.startsWith('cash_drawer/')) {
            return isCashier;
        }
        if (path.startsWith('arcade_secrets/')) {
            return isArcadeHost;
        }
        if (path.startsWith('arcade_questions/')) {
            return isArcadeHost;
        }
        if (path.startsWith('arcade_sessions/')) {
            if (operation === 'read') return isDisplay;
            if (operation === 'write') return isArcadeHost;
        }
        if (path.startsWith('arcade_participants/')) {
            return isArcadeHost;
        }
        return false;
    }

    const unauth = null;
    const cashierAuth = { uid: 'user-kasir', token: { role: 'cashier' } };
    const hostAuth = { uid: 'user-host', token: { role: 'arcade_host' } };
    const displayAuth = { uid: 'device-display', token: { role: 'arcade_display' } };
    const randomUser = { uid: 'user-random', token: { role: 'guest' } };

    await t.test('Unauthenticated ditolak di semua endpoint', () => {
        assert.equal(simulateAccess(unauth, 'products/item1', 'read'), false);
        assert.equal(simulateAccess(unauth, 'arcade_secrets/sec1', 'read'), false);
        assert.equal(simulateAccess(unauth, 'arcade_sessions/st1', 'read'), false);
    });

    await t.test('Display HANYA bisa membaca arcade_sessions dan DITOLAK di secrets & POS', () => {
        assert.equal(simulateAccess(displayAuth, 'arcade_sessions/station_1', 'read'), true);
        assert.equal(simulateAccess(displayAuth, 'arcade_sessions/station_1', 'write'), false);
        assert.equal(simulateAccess(displayAuth, 'arcade_secrets/q1', 'read'), false);
        assert.equal(simulateAccess(displayAuth, 'arcade_questions/q1', 'read'), false);
        assert.equal(simulateAccess(displayAuth, 'arcade_participants/p1', 'read'), false);
        assert.equal(simulateAccess(displayAuth, 'products/prod1', 'read'), false);
        assert.equal(simulateAccess(displayAuth, 'transactions/tx1', 'read'), false);
    });

    await t.test('Host bisa membaca & mengontrol Arcade tetapi tidak bisa bypass staff_roles write', () => {
        assert.equal(simulateAccess(hostAuth, 'arcade_secrets/q1', 'read'), true);
        assert.equal(simulateAccess(hostAuth, 'arcade_sessions/station_1', 'write'), true);
        assert.equal(simulateAccess(hostAuth, 'arcade_participants/p1', 'write'), true);
        assert.equal(simulateAccess(hostAuth, 'staff_roles/user-host', 'write'), false);
    });

    await t.test('Kasir bisa mengakses POS dan dilarang mengakses arcade_secrets', () => {
        assert.equal(simulateAccess(cashierAuth, 'products/prod1', 'read'), true);
        assert.equal(simulateAccess(cashierAuth, 'transactions/tx1', 'write'), true);
        assert.equal(simulateAccess(cashierAuth, 'arcade_secrets/q1', 'read'), false);
    });
});
