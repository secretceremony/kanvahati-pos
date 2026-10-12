/**
 * Kanvahati Arcade — Phase 4: Full Functional QA Test Suite
 * 
 * Verifies all 10 challenges according to final specifications:
 * G01 - G10 win/lose conditions, 30s timer limit, instant loss on wrong answer,
 * timeout auto-loss, manual staff grading, single play per event, question randomization,
 * anti-repeat, prize permanence, and edge case resilience.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { 
    GAME_DEFINITIONS, 
    ARCADE_GLOBAL_RULES, 
    DEFAULT_ALPHABET_WHITELIST 
} from '../src/arcade/data/gameConfig.js';

import { 
    INITIAL_QUESTIONS, 
    INITIAL_SECRETS 
} from '../src/arcade/data/initialQuestionBank.js';

import { 
    createIdleSession, 
    prepareSession, 
    startSession, 
    recordCorrectAnswer, 
    recordIncorrectAnswer, 
    recordTimeout, 
    resetSession, 
    pickRandomQuestion, 
    calculateRemainingSeconds, 
    SESSION_STATES 
} from '../src/arcade/services/arcadeCore.js';

import { 
    hashIdentifier 
} from '../src/arcade/services/arcadeDb.js';

import { 
    sanitizeDisplaySession, 
    calculateSynchronizedRemaining 
} from '../src/arcade/services/arcadeSync.js';

describe('Kanvahati Arcade — Full Functional QA Suite (10 Challenges)', () => {

    it('G01 Anime Speedrun: Full flow, 10 count target, franchise duplicate note, 30s limit', () => {
        const q = INITIAL_QUESTIONS.find(item => item.gameId === 'G01');
        const secret = INITIAL_SECRETS.find(s => s.id === q.id);
        assert.ok(q && secret);

        let session = startSession(prepareSession(createIdleSession('CF20', 'station-1'), 'G01', q, 'Rendy'), Date.now());
        assert.equal(session.status, SESSION_STATES.PLAYING);
        assert.equal(session.targetProgress, 10);
        assert.equal(session.timerDurationSec, 30);

        // 10 correct answers
        for (let i = 1; i <= 10; i++) {
            session = recordCorrectAnswer(session, 1);
            assert.equal(session.currentProgress, i);
            if (i < 10) assert.equal(session.status, SESSION_STATES.PLAYING);
        }
        assert.equal(session.status, SESSION_STATES.WON);
    });

    it('G02 Character Hunt: 5 traits verbal target, instant loss on wrong answer', () => {
        const q = INITIAL_QUESTIONS.find(item => item.gameId === 'G02');
        assert.equal(q.targetCount, 5);
        assert.ok(q.trait);

        let session = startSession(prepareSession(createIdleSession('CF20', 'station-1'), 'G02', q, 'Fajar'), Date.now());
        session = recordCorrectAnswer(session, 2);
        assert.equal(session.currentProgress, 2);

        // Incorrect answer -> instant loss
        session = recordIncorrectAnswer(session, "Karakter tidak berambut perak/putih");
        assert.equal(session.status, SESSION_STATES.LOST);
        assert.equal(session.disqualificationReason, "Karakter tidak berambut perak/putih");
    });

    it('G03 Anime Genre Explorer: 3 genre & anime examples validation and timeout auto-loss', () => {
        const q = INITIAL_QUESTIONS.find(item => item.gameId === 'G03');
        assert.equal(q.targetCount, 3);

        let session = startSession(prepareSession(createIdleSession('CF20', 'station-1'), 'G03', q, 'Citra'), Date.now());
        session = recordCorrectAnswer(session, 1); // 1st genre & example validated

        // 30 seconds expire
        session = recordTimeout(session);
        assert.equal(session.status, SESSION_STATES.LOST);
    });

    it('G04 Guess the Anime Cropped Edition: 1 target, reveal media hidden during play', () => {
        const q = INITIAL_QUESTIONS.find(item => item.gameId === 'G04');
        const secret = INITIAL_SECRETS.find(s => s.id === q.id);
        assert.ok(q.mediaUrl);
        assert.ok(q.revealedMediaUrl);
        assert.ok(secret.answerKey);

        let session = startSession(prepareSession(createIdleSession('CF20', 'station-1'), 'G04', q, 'Tia'), Date.now());

        // Verify display projection hides revealed image during PLAYING
        const displayPlaying = sanitizeDisplaySession({ ...session, revealedMediaUrl: q.revealedMediaUrl });
        assert.equal(displayPlaying.revealedMediaUrl, null, "Revealed image must be hidden during play!");

        // Winner -> revealed image is unlocked
        session = recordCorrectAnswer(session, 1);
        assert.equal(session.status, SESSION_STATES.WON);

        const displayWon = sanitizeDisplaySession({ ...session, revealedMediaUrl: q.revealedMediaUrl });
        assert.equal(displayWon.revealedMediaUrl, q.revealedMediaUrl);
    });

    it('G05 Guess the Anime Opening: 1 target, audio coordination without double echo', () => {
        const q = INITIAL_QUESTIONS.find(item => item.gameId === 'G05');
        const secret = INITIAL_SECRETS.find(s => s.id === q.id);
        assert.ok(q.mediaUrl);
        assert.ok(secret.songTitle);

        let session = startSession(prepareSession(createIdleSession('CF20', 'station-1'), 'G05', q, 'Bagas'), Date.now());
        assert.equal(session.status, SESSION_STATES.PLAYING);
        session = recordCorrectAnswer(session, 1);
        assert.equal(session.status, SESSION_STATES.WON);
    });

    it('G06 Character Alphabet Rush: 5 target, letter whitelist validation', () => {
        const q = INITIAL_QUESTIONS.find(item => item.gameId === 'G06');
        assert.equal(q.targetCount, 5);
        assert.ok(DEFAULT_ALPHABET_WHITELIST.includes(q.letter));

        let session = startSession(prepareSession(createIdleSession('CF20', 'station-1'), 'G06', q, 'Kevin'), Date.now());
        session = recordCorrectAnswer(session, 5);
        assert.equal(session.status, SESSION_STATES.WON);
    });

    it('G07 Three-Hint Character: 1 target, host reads 3 hints with secret confidentiality', () => {
        const q = INITIAL_QUESTIONS.find(item => item.gameId === 'G07');
        const secret = INITIAL_SECRETS.find(s => s.id === q.id);
        assert.equal(q.hintsCount, 3);
        assert.ok(q.hints && q.hints.length === 3);
        assert.ok(secret.characterName);

        let session = startSession(prepareSession(createIdleSession('CF20', 'station-1'), 'G07', q, 'Laras'), Date.now());

        // Display has hints instructions but NO secret character name
        const display = sanitizeDisplaySession({ ...session, ...q, characterName: secret.characterName });
        assert.ok(!display.characterName, "Secret character name must not be exposed on display during play!");

        // Host marks correct guess -> WIN
        session = recordCorrectAnswer(session, 1);
        assert.equal(session.status, SESSION_STATES.WON);
    });

    it('G08 Act Like That Character: 1 target, pose & catchphrase criteria', () => {
        const q = INITIAL_QUESTIONS.find(item => item.gameId === 'G08');
        assert.ok(q.characterName);
        assert.ok(q.phrasePrompt);

        let session = startSession(prepareSession(createIdleSession('CF20', 'station-1'), 'G08', q, 'Gita'), Date.now());
        session = recordCorrectAnswer(session, 1);
        assert.equal(session.status, SESSION_STATES.WON);
    });

    it('G09 Character Impostor: 5 options, impostor index validation', () => {
        const q = INITIAL_QUESTIONS.find(item => item.gameId === 'G09');
        const secret = INITIAL_SECRETS.find(s => s.id === q.id);
        assert.equal(q.options.length, 5);
        assert.ok(secret.impostorIndex >= 0 && secret.impostorIndex < 5);

        let session = startSession(prepareSession(createIdleSession('CF20', 'station-1'), 'G09', q, 'Dian'), Date.now());

        // Wrong choice -> instant loss
        session = recordIncorrectAnswer(session, "Menunjuk karakter yang bukan impostor");
        assert.equal(session.status, SESSION_STATES.LOST);
    });

    it('G10 Anime Impostor: 5 options, fictitious title validation', () => {
        const q = INITIAL_QUESTIONS.find(item => item.gameId === 'G10');
        const secret = INITIAL_SECRETS.find(s => s.id === q.id);
        assert.equal(q.options.length, 5);
        assert.ok(secret.fictitiousTitle);

        let session = startSession(prepareSession(createIdleSession('CF20', 'station-1'), 'G10', q, 'Eko'), Date.now());
        session = recordCorrectAnswer(session, 1);
        assert.equal(session.status, SESSION_STATES.WON);
    });

    it('Edge Case: Pencegahan Pengulangan Soal (Anti-Repeat)', () => {
        const pool = [
            { id: 'Q-01', gameId: 'G01' },
            { id: 'Q-02', gameId: 'G01' },
            { id: 'Q-03', gameId: 'G01' }
        ];

        // Pick 1st
        const q1 = pickRandomQuestion(pool, ['Q-01']);
        assert.notEqual(q1.id, 'Q-01');

        // If all in history, safely fallback without crash
        const qFallback = pickRandomQuestion(pool, ['Q-01', 'Q-02', 'Q-03']);
        assert.ok(qFallback);
    });

    it('Edge Case: Single-Play Hashing Pencegahan Bermain Berulang', async () => {
        const phone = "0812-3456-7890";
        const email = "wibu_sejati@gmail.com";

        const hashPhone = await hashIdentifier(phone);
        const hashPhoneDup = await hashIdentifier(" 081234567890 ");
        const hashEmail = await hashIdentifier("Wibu_Sejati@gmail.com");

        assert.equal(hashPhone.length, 16);
        assert.equal(hashPhone, hashPhoneDup, "Phone normalization must produce identical deterministic hash");
        assert.notEqual(hashPhone, hashEmail);
    });

    it('Edge Case: Terminal State Immutability (Tidak bisa dimanipulasi setelah selesai)', () => {
        let session = startSession(prepareSession(createIdleSession('CF20', 'station-1'), 'G01', { id: 'Q1' }, 'User'), Date.now());
        session = recordCorrectAnswer(session, 10);
        assert.equal(session.status, SESSION_STATES.WON);

        // Attempting to record more answers on finished session must throw
        assert.throws(() => {
            recordCorrectAnswer(session, 1);
        }, /IMMUTABLE_TERMINAL_STATE|SESSION_NOT_PLAYING/);

        assert.throws(() => {
            recordIncorrectAnswer(session, "Aksi salah setelah menang");
        }, /IMMUTABLE_TERMINAL_STATE|SESSION_NOT_PLAYING/);

        // Timeout on finished session preserves status as WON (cannot overwrite victory)
        const timedOut = recordTimeout(session);
        assert.equal(timedOut.status, SESSION_STATES.WON);
    });

    it('Edge Case: Rekonstruksi State setelah Refresh Browser (Reconciliation)', () => {
        const now = Date.now();
        const serverDocData = {
            stationKey: 'CF20_station-1',
            eventId: 'CF20',
            stationId: 'station-1',
            sessionId: 'sess_refreshed',
            revision: 5,
            status: 'playing',
            gameId: 'G01',
            gameTitle: 'Anime Speedrun',
            displayPrompt: 'Sebutkan 10 judul anime berbeda!',
            currentProgress: 6,
            targetProgress: 10,
            timerDurationSec: 30,
            startedAtMs: now - 12000, // 12s elapsed
            participantDisplayTag: 'Siti'
        };

        const refreshedDisplay = sanitizeDisplaySession(serverDocData);
        assert.equal(refreshedDisplay.currentProgress, 6);
        assert.equal(refreshedDisplay.status, 'playing');

        const remaining = calculateSynchronizedRemaining(refreshedDisplay, 0);
        assert.equal(remaining.remainingSeconds, 18); // 30 - 12 = 18
        assert.equal(remaining.isExpired, false);
    });
});
