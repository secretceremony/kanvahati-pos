import test from 'node:test';
import assert from 'node:assert/strict';

import { GAME_DEFINITIONS, ARCADE_GLOBAL_RULES, DEFAULT_ALPHABET_WHITELIST } from '../src/arcade/data/gameConfig.js';
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

test('Arcade Core Logic & State Machine Test Suite', async (t) => {

    await t.test('1. Semua 10 challenge final terkonfigurasi dengan benar', () => {
        const expectedIds = ['G01', 'G02', 'G03', 'G04', 'G05', 'G06', 'G07', 'G08', 'G09', 'G10'];
        assert.equal(Object.keys(GAME_DEFINITIONS).length, 10);
        
        expectedIds.forEach(id => {
            const def = GAME_DEFINITIONS[id];
            assert.ok(def, `Game ${id} harus terdefinisi`);
            assert.equal(def.timeLimitSec, 30);
            assert.ok(def.targetCount >= 1);
            assert.ok(def.displayInstruction);
            assert.ok(def.hostInstruction);
        });

        // Verifikasi keputusan spesifik
        assert.equal(GAME_DEFINITIONS.G01.targetCount, 10);
        assert.equal(GAME_DEFINITIONS.G02.targetCount, 5);
        assert.equal(GAME_DEFINITIONS.G03.targetCount, 3);
        assert.equal(GAME_DEFINITIONS.G06.targetCount, 5);
        assert.ok(DEFAULT_ALPHABET_WHITELIST.includes('S'));
        assert.ok(!DEFAULT_ALPHABET_WHITELIST.includes('Q'), 'Q harus dikecualikan dari default whitelist');
    });

    await t.test('2. Dataset Bank Soal mencakup seluruh 10 challenge dan terpisah dari kunci jawaban', () => {
        assert.ok(INITIAL_QUESTIONS.length >= 10, 'Bank soal harus mencakup setidaknya 10 soal');
        assert.equal(INITIAL_QUESTIONS.length, INITIAL_SECRETS.length, 'Jumlah soal publik dan rahasia harus sama');
        assert.equal(new Set(INITIAL_QUESTIONS.map(q => q.gameId)).size, 10, 'Semua 10 challenge harus memiliki soal');

        INITIAL_QUESTIONS.forEach(q => {
            assert.ok(q.id);
            assert.ok(q.gameId);
            assert.ok(q.displayPrompt);
            assert.equal(q.status, 'active');
            // Pastikan tidak ada kunci jawaban di objek pertanyaan publik
            assert.equal(q.answerKey, undefined, `Pertanyaan publik ${q.id} tidak boleh memiliki field answerKey!`);
        });

        INITIAL_SECRETS.forEach(s => {
            assert.ok(s.id);
            assert.ok(s.gameId);
            // Setiap secret harus memiliki pasangan pertanyaan
            const matchingQ = INITIAL_QUESTIONS.find(q => q.id === s.id);
            assert.ok(matchingQ, `Secret ${s.id} harus memiliki pasangan di INITIAL_QUESTIONS`);
        });
    });

    await t.test('3. Pengacakan soal menghindari pengulangan soal yang baru dimainkan', () => {
        const samplePool = [
            { id: 'Q1', title: 'Soal 1' },
            { id: 'Q2', title: 'Soal 2' },
            { id: 'Q3', title: 'Soal 3' }
        ];

        // Jika Q1 dan Q2 dikecualikan, harus memilih Q3
        const picked = pickRandomQuestion(samplePool, ['Q1', 'Q2']);
        assert.equal(picked.id, 'Q3');

        // Jika semua dikecualikan (pool habis), fallback ke pool penuh tanpa crash
        const fallbackPicked = pickRandomQuestion(samplePool, ['Q1', 'Q2', 'Q3']);
        assert.ok(fallbackPicked);
    });

    await t.test('4. Alur State Machine Lengkap Menuju Kemenangan (G01: 10 Target)', () => {
        let session = createIdleSession('CF20', 'station-1');
        assert.equal(session.status, SESSION_STATES.IDLE);

        const q = INITIAL_QUESTIONS.find(item => item.gameId === 'G01');
        session = prepareSession(session, 'G01', q, 'Peserta Miku');
        assert.equal(session.status, SESSION_STATES.READY);
        assert.equal(session.targetProgress, 10);

        const startTime = Date.now();
        session = startSession(session, startTime);
        assert.equal(session.status, SESSION_STATES.PLAYING);

        // Simulasi host menekan benar 10 kali
        for (let i = 1; i <= 9; i++) {
            session = recordCorrectAnswer(session);
            assert.equal(session.currentProgress, i);
            assert.equal(session.status, SESSION_STATES.PLAYING);
        }

        // Jawaban ke-10 (Target tercapai -> WON)
        session = recordCorrectAnswer(session);
        assert.equal(session.currentProgress, 10);
        assert.equal(session.status, SESSION_STATES.WON);
        assert.equal(session.result, 'win');

        // State WON adalah terminal: tidak dapat dimodifikasi lagi
        assert.throws(() => {
            recordCorrectAnswer(session);
        }, /IMMUTABLE_TERMINAL_STATE/);

        // Reset untuk pemain berikutnya
        session = resetSession(session);
        assert.equal(session.status, SESSION_STATES.IDLE);
    });

    await t.test('5. Kekalahan Instan ketika Host Menandai Jawaban Salah', () => {
        let session = createIdleSession('CF20', 'station-1');
        const q = INITIAL_QUESTIONS.find(item => item.gameId === 'G04');
        session = prepareSession(session, 'G04', q, 'Peserta Taro');
        session = startSession(session);

        // Host menandai jawaban salah (misal: menebak salah)
        session = recordIncorrectAnswer(session, "Salah tebak judul anime");
        assert.equal(session.status, SESSION_STATES.LOST);
        assert.equal(session.result, 'lose');
        assert.equal(session.disqualificationReason, "Salah tebak judul anime");

        // State LOST adalah terminal: tidak dapat dimodifikasi lagi
        assert.throws(() => {
            recordCorrectAnswer(session);
        }, /IMMUTABLE_TERMINAL_STATE/);
    });

    await t.test('6. Kekalahan Otomatis saat Waktu 30 Detik Habis (Timeout)', () => {
        let session = createIdleSession('CF20', 'station-1');
        const q = INITIAL_QUESTIONS.find(item => item.gameId === 'G02');
        session = prepareSession(session, 'G02', q, 'Peserta Hina');
        
        const startedAt = Date.now() - 31000; // 31 detik yang lalu
        session = startSession(session, startedAt);

        // Perhitungan sisa waktu menunjukkan 0 detik
        const remaining = calculateRemainingSeconds(session.startedAtMs, 30, Date.now());
        assert.equal(remaining, 0);

        // Handler timeout mengubah status ke LOST
        session = recordTimeout(session);
        assert.equal(session.status, SESSION_STATES.LOST);
        assert.equal(session.result, 'lose');
        assert.ok(session.disqualificationReason.includes('Timeout'));
    });

    await t.test('7. Minimal PII Hashing dan Validasi Klaim Hadiah', async () => {
        const hash1 = await hashIdentifier('  @KanvaHati_Fan ');
        const hash2 = await hashIdentifier('@kanvahati_fan');
        assert.equal(hash1, hash2, 'Hash harus identik untuk input yang sama');
        assert.ok(!hash1.includes('kanva'), 'Hash tidak boleh memuat plaintext handle');

        // Hadiah pemenang mencakup live sketch dan sticker
        assert.equal(ARCADE_GLOBAL_RULES.PRIZES.WIN.sketchCommission, true);
        assert.equal(ARCADE_GLOBAL_RULES.PRIZES.WIN.stickerFreebie, true);

        // Hadiah peserta kalah hanya sticker freebie
        assert.equal(ARCADE_GLOBAL_RULES.PRIZES.LOSE.sketchCommission, false);
        assert.equal(ARCADE_GLOBAL_RULES.PRIZES.LOSE.stickerFreebie, true);
    });
});
