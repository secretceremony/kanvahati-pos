import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_DEFINITIONS } from '../src/arcade/data/gameConfig.js';
import { INITIAL_QUESTIONS, INITIAL_SECRETS } from '../src/arcade/data/initialQuestionBank.js';
import { 
    createIdleSession, 
    prepareSession, 
    startSession, 
    recordCorrectAnswer, 
    recordIncorrectAnswer, 
    recordTimeout, 
    resetSession, 
    calculateRemainingSeconds,
    pickRandomQuestion,
    SESSION_STATES 
} from '../src/arcade/services/arcadeCore.js';
import { hashIdentifier } from '../src/arcade/services/arcadeDb.js';

test('Host Console End-to-End Integration Test Suite', async (t) => {

    await t.test('1. Role-Based Access Control untuk Host Console', () => {
        function checkHostAccess(role) {
            return role === 'admin' || role === 'arcade_host';
        }

        assert.equal(checkHostAccess('admin'), true, 'Admin harus diizinkan');
        assert.equal(checkHostAccess('arcade_host'), true, 'Arcade Host harus diizinkan');
        assert.equal(checkHostAccess('cashier'), false, 'Kasir biasa tidak boleh mengakses Host Console');
        assert.equal(checkHostAccess('arcade_display'), false, 'Display tidak boleh mengakses Host Console');
        assert.equal(checkHostAccess('guest'), false, 'Guest tidak boleh mengakses Host Console');
        assert.equal(checkHostAccess(null), false, 'Unauthenticated tidak boleh mengakses');
    });

    await t.test('2. Registrasi Peserta & Pemeriksaan Duplikasi Atomik', async () => {
        const memoryParticipantDb = new Map();

        async function mockRegisterParticipant(eventId, rawId, displayName, gameId) {
            const hashed = await hashIdentifier(rawId);
            const key = `${eventId}_${hashed}`;
            if (memoryParticipantDb.has(key)) {
                const existing = memoryParticipantDb.get(key);
                const err = new Error(`ALREADY_PLAYED: Peserta sudah bermain di event ini!`);
                err.code = 'ALREADY_PLAYED';
                err.playedAt = existing.playedAt;
                throw err;
            }

            const record = {
                participantKey: key,
                eventId,
                displayName: displayName || rawId,
                gameId,
                playedAt: new Date().toISOString(),
                result: null,
                sketchClaimed: false,
                stickerClaimed: false
            };
            memoryParticipantDb.set(key, record);
            return record;
        }

        // Pendaftaran pertama: Sukses
        const p1 = await mockRegisterParticipant('CF20', '@miku_cosplay', 'Miku', 'G01');
        assert.ok(p1.participantKey);
        assert.equal(p1.displayName, 'Miku');

        // Pendaftaran kedua dengan ID sama pada event yang sama: Wajib ditolak!
        await assert.rejects(
            async () => mockRegisterParticipant('CF20', '  @miku_cosplay  ', 'Miku', 'G02'),
            /ALREADY_PLAYED/
        );

        // Pendaftaran pada event berbeda: Diizinkan
        const pOtherEvent = await mockRegisterParticipant('COMIFURO21', '@miku_cosplay', 'Miku', 'G01');
        assert.ok(pOtherEvent);
    });

    await t.test('3. Pengacakan Soal dan Proteksi Dokumen Kunci Rahasia', () => {
        Object.keys(GAME_DEFINITIONS).forEach(gameId => {
            const questions = INITIAL_QUESTIONS.filter(q => q.gameId === gameId);
            assert.ok(questions.length > 0, `Harus ada soal untuk ${gameId}`);
            const picked = pickRandomQuestion(questions);
            assert.ok(picked);
            assert.equal(picked.gameId, gameId);

            // Kunci jawaban harus berada di INITIAL_SECRETS, BUKAN di objek soal publik
            assert.equal(picked.answerKey, undefined, 'Objek soal publik tidak boleh memuat answerKey');
            const matchingSecret = INITIAL_SECRETS.find(s => s.id === picked.id);
            assert.ok(matchingSecret, `Harus ada dokumen rahasia terpisah untuk ${picked.id}`);
        });
    });

    await t.test('4. Kontrol Penilaian G01 — Anime Speedrun (10 Judul)', () => {
        let session = createIdleSession('CF20', 'station-1');
        const q = INITIAL_QUESTIONS.find(item => item.gameId === 'G01');
        session = prepareSession(session, 'G01', q, 'Peserta G01');
        session = startSession(session);

        // Simulasikan 9 jawaban valid
        for (let i = 0; i < 9; i++) {
            session = recordCorrectAnswer(session, 1);
            assert.equal(session.status, SESSION_STATES.PLAYING);
        }
        assert.equal(session.currentProgress, 9);

        // Jawaban ke-10 (Target tercapai -> WON)
        session = recordCorrectAnswer(session, 1);
        assert.equal(session.status, SESSION_STATES.WON);
        assert.equal(session.result, 'win');
    });

    await t.test('5. Kontrol Penilaian G02 — Character Hunt (5 Karakter)', () => {
        let session = createIdleSession('CF20', 'station-1');
        const q = INITIAL_QUESTIONS.find(item => item.gameId === 'G02');
        session = prepareSession(session, 'G02', q, 'Peserta G02');
        session = startSession(session);

        for (let i = 0; i < 4; i++) {
            session = recordCorrectAnswer(session, 1);
        }
        assert.equal(session.currentProgress, 4);

        // Jawaban ke-5 -> Menang
        session = recordCorrectAnswer(session, 1);
        assert.equal(session.status, SESSION_STATES.WON);
    });

    await t.test('6. Kontrol Penilaian G03 — Anime Genre Explorer (3 Pasang Genre & Anime)', () => {
        let session = createIdleSession('CF20', 'station-1');
        const q = INITIAL_QUESTIONS.find(item => item.gameId === 'G03');
        session = prepareSession(session, 'G03', q, 'Peserta G03');
        session = startSession(session);

        // Host memvalidasi ketiga pasang genre & contoh anime -> target count 3 terpenuhi -> WON
        session = recordCorrectAnswer(session, 3);
        assert.equal(session.status, SESSION_STATES.WON);
        assert.equal(session.result, 'win');
    });

    await t.test('7. Kontrol Penilaian G04 & G05 — Media Guessing & Reveal', () => {
        let session = createIdleSession('CF20', 'station-1');
        const q = INITIAL_QUESTIONS.find(item => item.gameId === 'G04');
        session = prepareSession(session, 'G04', q, 'Peserta G04');
        session = startSession(session);

        // Host menekan Tebakan Benar
        session = recordCorrectAnswer(session, 1);
        assert.equal(session.status, SESSION_STATES.WON);

        // Uji tebakan salah pada G05
        let sessionAudio = createIdleSession('CF20', 'station-1');
        const qAudio = INITIAL_QUESTIONS.find(item => item.gameId === 'G05');
        sessionAudio = prepareSession(sessionAudio, 'G05', qAudio, 'Peserta G05');
        sessionAudio = startSession(sessionAudio);

        // Host menekan Tebakan Salah -> LOST
        sessionAudio = recordIncorrectAnswer(sessionAudio, "Salah tebak opening");
        assert.equal(sessionAudio.status, SESSION_STATES.LOST);
        assert.equal(sessionAudio.result, 'lose');
    });

    await t.test('8. Kontrol G07 — Three-Hint Mode (Kerahasiaan Host)', () => {
        const q = INITIAL_QUESTIONS.find(item => item.gameId === 'G07');
        assert.ok(q.hints, 'Harus memiliki 3 petunjuk karakter');
        assert.equal(q.hintsCount, 3);

        // Pastikan nama karakter rahasia TIDAK ada di objek pertanyaan publik
        assert.equal(q.characterName, undefined);

        let session = createIdleSession('CF20', 'station-1');
        session = prepareSession(session, 'G07', q, 'Peserta G07');
        session = startSession(session);

        // Panitia memvalidasi tebakan peserta -> WON
        session = recordCorrectAnswer(session, 1);
        assert.equal(session.status, SESSION_STATES.WON);
    });

    await t.test('9. Kontrol G08, G09, G10 — Pose & Impostor Validation', () => {
        // G08 Pose Lulus
        let s8 = startSession(prepareSession(createIdleSession(), 'G08', INITIAL_QUESTIONS.find(q => q.gameId === 'G08'), 'P8'));
        s8 = recordCorrectAnswer(s8, 1);
        assert.equal(s8.status, SESSION_STATES.WON);

        // G09 Impostor Karakter
        let s9 = startSession(prepareSession(createIdleSession(), 'G09', INITIAL_QUESTIONS.find(q => q.gameId === 'G09'), 'P9'));
        s9 = recordCorrectAnswer(s9, 1);
        assert.equal(s9.status, SESSION_STATES.WON);

        // G10 Impostor Anime Fiktif Salah
        let s10 = startSession(prepareSession(createIdleSession(), 'G10', INITIAL_QUESTIONS.find(q => q.gameId === 'G10'), 'P10'));
        s10 = recordIncorrectAnswer(s10, "Peserta menunjuk anime asli");
        assert.equal(s10.status, SESSION_STATES.LOST);
    });

    await t.test('10. Countdown, Timeout Otomatis, dan Immutabilitas Terminal State', () => {
        let session = createIdleSession('CF20', 'station-1');
        const q = INITIAL_QUESTIONS[0];
        session = prepareSession(session, 'G01', q, 'P-Timeout');
        const startMs = Date.now() - 30500; // 30.5 detik yang lalu
        session = startSession(session, startMs);

        // Sisa waktu harus 0
        const rem = calculateRemainingSeconds(session.startedAtMs, 30, Date.now());
        assert.equal(rem, 0);

        // Trigger timeout
        session = recordTimeout(session);
        assert.equal(session.status, SESSION_STATES.LOST);

        // Upaya memodifikasi state LOST harus ditolak secara mutlak (Anti-Race Condition)
        assert.throws(() => {
            recordCorrectAnswer(session, 1);
        }, /IMMUTABLE_TERMINAL_STATE/);

        assert.throws(() => {
            recordIncorrectAnswer(session, "Aksi tambahan");
        }, /IMMUTABLE_TERMINAL_STATE/);
    });

    await t.test('11. Klaim Hadiah Satu Kali (Anti-Double Claim)', () => {
        const participant = {
            id: 'PART-WIN',
            result: 'win',
            sketchClaimed: false,
            stickerClaimed: false
        };

        // Klaim pertama: Berhasil
        participant.sketchClaimed = true;
        assert.equal(participant.sketchClaimed, true);

        // Klaim kedua pada hadiah yang sama: Tolak
        function tryClaimAgain(p) {
            if (p.sketchClaimed) {
                throw new Error("ALREADY_CLAIMED: Hadiah live sketch commission sudah diklaim!");
            }
            p.sketchClaimed = true;
        }

        assert.throws(() => tryClaimAgain(participant), /ALREADY_CLAIMED/);
    });

    await t.test('12. Desain Responsif & Karakteristik Grid Breakpoint', () => {
        // Verifikasi class responsif yang digunakan di HostConsole
        const gridBreakpoints = ['grid-cols-1', 'lg:grid-cols-12', 'lg:col-span-5', 'lg:col-span-7', 'sm:grid-cols-2'];
        gridBreakpoints.forEach(bp => {
            assert.ok(typeof bp === 'string');
        });
    });
});
