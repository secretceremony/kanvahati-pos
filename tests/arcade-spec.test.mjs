import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// Master 10 Final Challenge Definitions
export const FINAL_CHALLENGES = [
    { id: 'G01', name: 'Anime Speedrun', targetCount: 10, evalType: 'verbal_counter', timeLimitSec: 30 },
    { id: 'G02', name: 'Character Hunt', targetCount: 5, evalType: 'verbal_counter_criteria', timeLimitSec: 30 },
    { id: 'G03', name: 'Anime Genre Explorer', targetCount: 3, evalType: 'genre_examples', timeLimitSec: 30 },
    { id: 'G04', name: 'Guess the Anime: Cropped Edition', targetCount: 1, evalType: 'cropped_image', timeLimitSec: 30 },
    { id: 'G05', name: 'Guess the Anime Opening', targetCount: 1, evalType: 'audio_clip', timeLimitSec: 30 },
    { id: 'G06', name: 'Character Alphabet Rush', targetCount: 5, evalType: 'alphabet_rush', timeLimitSec: 30 },
    { id: 'G07', name: 'Three-Hint Character', targetCount: 1, evalType: 'host_three_hints', timeLimitSec: 30 },
    { id: 'G08', name: 'Act Like That Character!', targetCount: 1, evalType: 'pose_demonstration', timeLimitSec: 30 },
    { id: 'G09', name: 'Find the Impostor: Character Edition', targetCount: 1, evalType: 'impostor_character', timeLimitSec: 30 },
    { id: 'G10', name: 'Find the Impostor: Anime Edition', targetCount: 1, evalType: 'impostor_anime', timeLimitSec: 30 }
];

test('Kanvahati Arcade 10 Challenges Specification Validation', async (t) => {
    await t.test('1. Pastikan tepat 10 challenge terdefinisi dengan batas waktu 30 detik', () => {
        assert.equal(FINAL_CHALLENGES.length, 10);
        FINAL_CHALLENGES.forEach(c => {
            assert.equal(c.timeLimitSec, 30, `${c.name} harus memiliki time limit 30s`);
            assert.ok(c.id.match(/^G(0[1-9]|10)$/), `${c.id} harus berformat G01-G10`);
        });
    });

    await t.test('2. Minimal PII Hashed Identifier Generator', () => {
        // Generator kunci unik peserta berbasis hash satu arah (SHA-256) untuk menjaga privasi
        function generateParticipantKey(eventId, identifierRaw) {
            const clean = identifierRaw.trim().toLowerCase();
            const hash = crypto.createHash('sha256').update(clean).digest('hex').substring(0, 16);
            return `${eventId}_${hash}`;
        }

        const eventId = "CF20";
        const rawHandle = "  @MikuFan_99  ";
        const key1 = generateParticipantKey(eventId, rawHandle);
        const key2 = generateParticipantKey(eventId, "@mikufan_99");

        assert.equal(key1, key2, "Identifier harus dinormalisasi case & whitespace secara konsisten");
        assert.ok(key1.startsWith("CF20_"), "Key harus memiliki prefix eventId");
        assert.ok(!key1.includes("mikufan"), "Key tidak boleh memuat plaintext PII handle");
    });

    await t.test('3. Pencegahan Permainan Berulang secara Atomik (Unique Key Simulation)', () => {
        const participantDb = new Map();

        function registerParticipant(eventId, identifierRaw) {
            const clean = identifierRaw.trim().toLowerCase();
            const hash = crypto.createHash('sha256').update(clean).digest('hex').substring(0, 16);
            const docId = `${eventId}_${hash}`;

            if (participantDb.has(docId)) {
                throw new Error("ALREADY_PLAYED: Peserta sudah pernah bermain pada event ini!");
            }

            participantDb.set(docId, {
                docId,
                eventId,
                createdAt: new Date().toISOString()
            });
            return docId;
        }

        // Percobaan pertama: Sukses
        const id1 = registerParticipant("CF20", "@dewi_art");
        assert.ok(id1);

        // Percobaan kedua di event yang sama: Wajib ditolak secara atomik
        assert.throws(() => {
            registerParticipant("CF20", "@dewi_art");
        }, /ALREADY_PLAYED/);

        // Percobaan di event berbeda: Diizinkan (1x per event)
        const idOtherEvent = registerParticipant("CSF2026", "@dewi_art");
        assert.ok(idOtherEvent);
    });

    await t.test('4. Sinkronisasi Timer 30 Detik dengan Penanganan Clock Drift', () => {
        // Simulasi server timestamp
        const serverNow = 1775800000000;
        const startedAtMs = serverNow - 12000; // Sudah berjalan 12 detik
        const durationSec = 30;

        function calculateRemainingTime(serverStartedAtMs, durationSec, currentServerEstimateMs) {
            const elapsedSec = (currentServerEstimateMs - serverStartedAtMs) / 1000;
            const remaining = Math.max(0, Math.ceil(durationSec - elapsedSec));
            return remaining;
        }

        const remaining = calculateRemainingTime(startedAtMs, durationSec, serverNow);
        assert.equal(remaining, 18, "Sisa waktu harus tepat 18 detik");

        // Ketika waktu melewati 30 detik
        const expiredServerMs = startedAtMs + 31000;
        const remainingExpired = calculateRemainingTime(startedAtMs, durationSec, expiredServerMs);
        assert.equal(remainingExpired, 0, "Sisa waktu tidak boleh negatif saat expired");
    });
});
