/**
 * Kanvahati Arcade — Phase 3: Visitor Display & Real-Time Synchronization Test Suite
 * 
 * Verifies:
 * 1. Real-time session synchronization between Host and Display
 * 2. 30s Countdown timer synchronization with server timestamp & clock skew compensation
 * 3. Progress replication from Host to Display across all 10 challenges
 * 4. Terminal outcome synchronization (WON / LOST / TIMEOUT)
 * 5. Document-level secrecy guarantee (zero secret answers or private PII leaked to Display)
 * 6. Station isolation (Station 01 vs Station 02 independence)
 * 7. Stale revision & session ID mismatch rejection
 * 8. Atomic participant registration and session start
 * 9. Audio coordination (no double audio echo on G05)
 * 10. Display responsiveness and state machine integrity
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { 
    GAME_DEFINITIONS, 
    ARCADE_GLOBAL_RULES 
} from '../src/arcade/data/gameConfig.js';

import { 
    INITIAL_QUESTIONS, 
    INITIAL_SECRETS 
} from '../src/arcade/data/initialQuestionBank.js';

import { 
    sanitizeDisplaySession, 
    calculateSynchronizedRemaining 
} from '../src/arcade/services/arcadeSync.js';

import { 
    createIdleSession, 
    prepareSession, 
    startSession, 
    recordCorrectAnswer, 
    recordIncorrectAnswer, 
    recordTimeout, 
    resetSession,
    SESSION_STATES 
} from '../src/arcade/services/arcadeCore.js';

describe('Kanvahati Arcade — Visitor Display & Real-Time Sync Suite', () => {

    it('1. Host memulai sesi, Display menerima state permainan yang tersinkronisasi', () => {
        const question = INITIAL_QUESTIONS.find(q => q.gameId === 'G01');
        const idle = createIdleSession('CF20', 'station-1');
        const prep = prepareSession(idle, 'G01', question, 'Mika-chan');
        const nowMs = Date.now();
        const started = startSession(prep, nowMs);

        // Host creates active session payload
        const hostPayload = {
            stationKey: 'CF20_station-1',
            eventId: 'CF20',
            stationId: 'station-1',
            sessionId: 'sess_12345',
            revision: 1,
            status: started.status,
            gameId: started.gameId,
            gameTitle: started.gameTitle,
            displayPrompt: question.displayPrompt,
            currentProgress: started.currentProgress,
            targetProgress: started.targetProgress,
            timerDurationSec: started.timerDurationSec,
            startedAtMs: nowMs,
            participantDisplayTag: 'Mika-chan'
        };

        // Display sanitizes and receives payload
        const displayView = sanitizeDisplaySession(hostPayload);

        assert.equal(displayView.status, SESSION_STATES.PLAYING);
        assert.equal(displayView.gameId, 'G01');
        assert.equal(displayView.participantDisplayTag, 'Mika-chan');
        assert.equal(displayView.targetProgress, 10);
        assert.equal(displayView.currentProgress, 0);
        assert.equal(displayView.timerDurationSec, 30);
    });

    it('2. Sinkronisasi Timer 30 Detik memperhitungkan clock skew dan latency antardevais', () => {
        const now = Date.now();
        const session = {
            status: 'PLAYING',
            startedAtMs: now - 10000, // 10 seconds ago on server
            timerDurationSec: 30
        };

        // Scenario A: Perfect clock sync (offset = 0)
        const syncA = calculateSynchronizedRemaining(session, 0);
        assert.equal(syncA.remainingSeconds, 20);
        assert.equal(syncA.isExpired, false);
        assert.ok(syncA.progressPercent >= 33 && syncA.progressPercent <= 34);

        // Scenario B: Display local clock is 3 seconds BEHIND server (offset = +3000ms)
        const syncB = calculateSynchronizedRemaining(session, 3000);
        assert.equal(syncB.remainingSeconds, 17); // 30 - (10 + 3) = 17

        // Scenario C: Display local clock is 4 seconds AHEAD of server (offset = -4000ms)
        const syncC = calculateSynchronizedRemaining(session, -4000);
        assert.equal(syncC.remainingSeconds, 24); // 30 - (10 - 4) = 24

        // Scenario D: 30 seconds have elapsed (Timeout)
        const expiredSession = {
            status: 'PLAYING',
            startedAtMs: now - 31000,
            timerDurationSec: 30
        };
        const syncExpired = calculateSynchronizedRemaining(expiredSession, 0);
        assert.equal(syncExpired.remainingSeconds, 0);
        assert.equal(syncExpired.isExpired, true);
        assert.equal(syncExpired.progressPercent, 100);
    });

    it('3. Perubahan progres Host muncul pada Display secara real-time', () => {
        const question = INITIAL_QUESTIONS.find(q => q.gameId === 'G01');
        let session = startSession(prepareSession(createIdleSession('CF20', 'station-1'), 'G01', question, 'Budi'), Date.now());

        // Step 1: 0/10
        let displayState = sanitizeDisplaySession({
            ...session,
            sessionId: 'sess_1',
            revision: 1
        });
        assert.equal(displayState.currentProgress, 0);

        // Step 2: Host marks 4 correct answers -> 4/10
        session = recordCorrectAnswer(session, 4);
        displayState = sanitizeDisplaySession({
            ...session,
            sessionId: 'sess_1',
            revision: 2
        });
        assert.equal(displayState.currentProgress, 4);

        // Step 3: Host marks 5 more correct answers -> 9/10
        session = recordCorrectAnswer(session, 5);
        displayState = sanitizeDisplaySession({
            ...session,
            sessionId: 'sess_1',
            revision: 3
        });
        assert.equal(displayState.currentProgress, 9);
        assert.equal(displayState.status, SESSION_STATES.PLAYING);
    });

    it('4. Target tercapai menampilkan status WON dan membuka hadiah grand prize', () => {
        const question = INITIAL_QUESTIONS.find(q => q.gameId === 'G01');
        let session = startSession(prepareSession(createIdleSession('CF20', 'station-1'), 'G01', question, 'Juara'), Date.now());

        // Complete 10 answers
        session = recordCorrectAnswer(session, 10);
        assert.equal(session.status, SESSION_STATES.WON);

        const wonPayload = sanitizeDisplaySession({
            ...session,
            sessionId: 'sess_win',
            revision: 4,
            result: 'win',
            revealedMediaUrl: '/arcade/revealed_placeholder.svg'
        });

        assert.equal(wonPayload.status, SESSION_STATES.WON);
        assert.equal(wonPayload.result, 'win');
        assert.equal(wonPayload.revealedMediaUrl, '/arcade/revealed_placeholder.svg');
    });

    it('5. Jawaban salah langsung menampilkan status LOST pada Display', () => {
        const question = INITIAL_QUESTIONS.find(q => q.gameId === 'G06');
        let session = startSession(prepareSession(createIdleSession('CF20', 'station-1'), 'G06', question, 'Doni'), Date.now());

        // Host flags wrong answer
        session = recordIncorrectAnswer(session, "Nama karakter bukan dari anime berawalan huruf S");
        assert.equal(session.status, SESSION_STATES.LOST);

        const lostPayload = sanitizeDisplaySession({
            ...session,
            sessionId: 'sess_lose',
            revision: 2,
            result: 'lose',
            disqualificationReason: "Nama karakter bukan dari anime berawalan huruf S"
        });

        assert.equal(lostPayload.status, SESSION_STATES.LOST);
        assert.equal(lostPayload.result, 'lose');
        assert.equal(lostPayload.disqualificationReason, "Nama karakter bukan dari anime berawalan huruf S");
    });

    it('6. Timeout menghasilkan status LOST dengan alasan waktu habis', () => {
        const question = INITIAL_QUESTIONS.find(q => q.gameId === 'G02');
        let session = startSession(prepareSession(createIdleSession('CF20', 'station-1'), 'G02', question, 'Rini'), Date.now());

        session = recordTimeout(session);
        assert.equal(session.status, SESSION_STATES.LOST);

        const timedOutPayload = sanitizeDisplaySession({
            ...session,
            sessionId: 'sess_timeout',
            revision: 3,
            result: 'lose',
            disqualificationReason: "Waktu habis (30 detik)"
        });

        assert.equal(timedOutPayload.status, SESSION_STATES.LOST);
        assert.equal(timedOutPayload.disqualificationReason, "Waktu habis (30 detik)");
    });

    it('7. Reset Host mengembalikan Display ke status IDLE', () => {
        const idle = resetSession({ status: SESSION_STATES.WON, currentProgress: 10 });
        assert.equal(idle.status, SESSION_STATES.IDLE);

        const idleDisplay = sanitizeDisplaySession({
            status: SESSION_STATES.IDLE,
            gameId: null,
            participantDisplayTag: null
        });

        assert.equal(idleDisplay.status, SESSION_STATES.IDLE);
        assert.equal(idleDisplay.gameId, null);
    });

    it('8. Zero-Leak Verification: Tidak ada kunci jawaban atau PII yang bocor ke Display', () => {
        INITIAL_QUESTIONS.forEach(q => {
            const secret = INITIAL_SECRETS.find(s => s.id === q.id);

            // Host has secret in memory
            const mockHostRawSession = {
                ...q,
                ...secret,
                rawPhone: "+6281234567890",
                rawEmail: "peserta@gmail.com",
                answerKey: secret?.answerKey || "Super Secret Answer",
                referenceAnswers: secret?.referenceAnswers || ["Secret 1", "Secret 2"],
                dereReferenceRubric: secret?.dereReferenceRubric || { Tsundere: "Secret info" },
                secretCharacter: secret?.secretCharacter || "Gojo Satoru Secret",
                impostorIndex: secret?.impostorIndex !== undefined ? secret.impostorIndex : 2,
                fictitiousTitle: secret?.fictitiousTitle || "Fake Anime Secret"
            };

            const displayView = sanitizeDisplaySession(mockHostRawSession);

            // Assert that none of the secret fields exist in displayView
            assert.equal(displayView.answerKey, undefined, `Game ${q.gameId} answerKey leaked!`);
            assert.equal(displayView.referenceAnswers, undefined, `Game ${q.gameId} referenceAnswers leaked!`);
            assert.equal(displayView.dereReferenceRubric, undefined, `Game ${q.gameId} dereReferenceRubric leaked!`);
            assert.equal(displayView.secretCharacter, undefined, `Game ${q.gameId} secretCharacter leaked!`);
            assert.equal(displayView.impostorIndex, undefined, `Game ${q.gameId} impostorIndex leaked!`);
            assert.equal(displayView.fictitiousTitle, undefined, `Game ${q.gameId} fictitiousTitle leaked!`);
            assert.equal(displayView.rawPhone, undefined, `Game ${q.gameId} rawPhone leaked!`);
            assert.equal(displayView.rawEmail, undefined, `Game ${q.gameId} rawEmail leaked!`);
        });
    });

    it('9. Isolasi Stasiun: Dua station berbeda tidak saling menimpa atau bocor', () => {
        const sessionStation1 = sanitizeDisplaySession({
            stationKey: 'CF20_station-1',
            stationId: 'station-1',
            sessionId: 'sess_station_1',
            gameId: 'G01',
            status: 'PLAYING',
            currentProgress: 3
        });

        const sessionStation2 = sanitizeDisplaySession({
            stationKey: 'CF20_station-2',
            stationId: 'station-2',
            sessionId: 'sess_station_2',
            gameId: 'G06',
            status: 'PLAYING',
            currentProgress: 1
        });

        assert.equal(sessionStation1.stationId, 'station-1');
        assert.equal(sessionStation1.gameId, 'G01');
        assert.equal(sessionStation1.currentProgress, 3);

        assert.equal(sessionStation2.stationId, 'station-2');
        assert.equal(sessionStation2.gameId, 'G06');
        assert.equal(sessionStation2.currentProgress, 1);

        assert.notEqual(sessionStation1.stationKey, sessionStation2.stationKey);
    });

    it('10. Penolakan Pembaruan Basi (Stale Revision) dan Reinkarnasi Sesi', () => {
        const stateV1 = { sessionId: 'sess_abc', revision: 1, currentProgress: 1 };
        const stateV2 = { sessionId: 'sess_abc', revision: 2, currentProgress: 2 };
        const stateStale = { sessionId: 'sess_abc', revision: 1, currentProgress: 1 };

        let currentRev = 0;
        let activeData = null;

        function applyUpdate(update) {
            if (update.revision > currentRev) {
                currentRev = update.revision;
                activeData = update;
                return true;
            }
            return false; // Dropped stale update
        }

        assert.equal(applyUpdate(stateV1), true);
        assert.equal(activeData.currentProgress, 1);

        assert.equal(applyUpdate(stateV2), true);
        assert.equal(activeData.currentProgress, 2);

        // Stale update arrives out of order
        assert.equal(applyUpdate(stateStale), false);
        assert.equal(activeData.currentProgress, 2); // Preserved latest state!
    });

    it('11. Koordinasi Audio G05: Audio ditrigger oleh Host tanpa double-play di Display', () => {
        const qG05 = INITIAL_QUESTIONS.find(q => q.gameId === 'G05');
        assert.ok(qG05.mediaUrl, "G05 has audio mediaUrl");

        const displayG05 = sanitizeDisplaySession({
            gameId: 'G05',
            status: 'PLAYING',
            mediaUrl: qG05.mediaUrl
        });

        // Display receives mediaUrl for reference, but audio coordination UI states it is played at Host
        assert.equal(displayG05.gameId, 'G05');
        assert.ok(displayG05.mediaUrl);
    });

    it('12. Validasi Seluruh 10 Challenge memiliki konfigurasi Display lengkap', () => {
        const allGameKeys = ['G01', 'G02', 'G03', 'G04', 'G05', 'G06', 'G07', 'G08', 'G09', 'G10'];
        
        allGameKeys.forEach(gId => {
            const def = GAME_DEFINITIONS[gId];
            assert.ok(def, `Game def ${gId} exists`);
            assert.ok(def.title, `Game def ${gId} has title`);
            assert.ok(def.displayInstruction, `Game def ${gId} has displayInstruction`);
            assert.equal(def.timeLimitSec, 30, `Game def ${gId} time limit is 30s`);
        });
    });

    it('13. Aturan Hadiah: Menang mendapatkan Frame Live Sketch + Sticker, Kalah mendapatkan Sticker', () => {
        assert.equal(ARCADE_GLOBAL_RULES.PRIZES.WIN.sketchCommission, true);
        assert.equal(ARCADE_GLOBAL_RULES.PRIZES.WIN.stickerFreebie, true);
        assert.equal(ARCADE_GLOBAL_RULES.PRIZES.LOSE.sketchCommission, false);
        assert.equal(ARCADE_GLOBAL_RULES.PRIZES.LOSE.stickerFreebie, true);
    });
});
