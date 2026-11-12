import test from 'node:test';
import assert from 'node:assert/strict';
import {
    GAME_DEFINITIONS,
    resolveQuizModeParams,
    REACTION_BATTLE_CONFIG
} from '../src/arcade/data/gameConfig.js';
import { prepareSession, SESSION_STATES } from '../src/arcade/services/arcadeCore.js';
import {
    REACTION_STATES,
    createReactionRoom,
    resolveAuthoritativeTapMs,
    adjudicateReactionRound,
    advanceToNextReactionRound,
    resetReactionForRematch
} from '../src/arcade/services/reactionCore.js';
import { computeArcadeQuotaStatus } from '../src/arcade/services/arcadeDb.js';

test('Arcade v2: Quiz Enhancements & Reaction Battle PvP Suite', async (t) => {
    await t.test('1. Quiz difficulty & mode presets compute expected timers and targets cleanly', () => {
        const g01 = GAME_DEFINITIONS.G01; // 30s, 10x
        const normalClassic = resolveQuizModeParams(g01, 'normal', 'classic');
        assert.equal(normalClassic.timerDurationSec, 30);
        assert.equal(normalClassic.targetCount, 10);

        const easyClassic = resolveQuizModeParams(g01, 'easy', 'classic');
        assert.equal(easyClassic.timerDurationSec, 40);
        assert.equal(easyClassic.targetCount, 8);

        const speedHard = resolveQuizModeParams(g01, 'hard', 'speed_round');
        assert.equal(speedHard.timerDurationSec, 15);
        assert.equal(speedHard.targetCount, 12);

        const bossNormal = resolveQuizModeParams(GAME_DEFINITIONS.G04, 'normal', 'boss_question');
        assert.equal(bossNormal.timerDurationSec, 45);
        assert.equal(bossNormal.targetCount, 1);
    });

    await t.test('2. prepareSession stores difficulty, quizMode, custom timer & target without breaking defaults', () => {
        const idle = { eventId: 'CF20', stationId: 'station-1', status: SESSION_STATES.IDLE };
        const prep = prepareSession(idle, 'G04', { id: 'Q-G04-001' }, 'Mika', {
            difficulty: 'hard',
            quizMode: 'boss_question',
            timerDurationSec: 40,
            targetCount: 1
        });
        assert.equal(prep.status, SESSION_STATES.READY);
        assert.equal(prep.difficulty, 'hard');
        assert.equal(prep.quizMode, 'boss_question');
        assert.equal(prep.timerDurationSec, 40);
    });

    await t.test('3. Reaction Battle: false start before GO! signal immediately loses the round', () => {
        const room = createReactionRoom({ roomCode: 'K7M4PX', eventId: 'CF20', participantName: 'Mika' });
        room.status = REACTION_STATES.ARMED;
        room.round.armedAtMs = 10000;
        room.round.signalDelayMs = 3000;
        room.round.goAtMs = 13000;

        const next = adjudicateReactionRound(room, {
            visitorTap: { role: 'visitor', serverAtMs: 12100, clientAtMs: 12100, clockOffsetMs: 0 },
            hostTap: null,
            nowMs: 12150
        });

        assert.equal(next.status, REACTION_STATES.ROUND_END);
        assert.equal(next.round.winner, 'host');
        assert.equal(next.round.winReason, 'false_start');
        assert.equal(next.round.visitorFalseStart, true);
        assert.equal(next.host.score, 1);
        assert.equal(next.visitor.score, 0);
    });

    await t.test('4. Reaction Battle: fastest valid reaction after GO! wins round & Best-of-3 finishes on 2 wins', () => {
        let room = createReactionRoom({ roomCode: 'DUEL99', eventId: 'CF20', participantName: 'Mika' });

        // Round 1: Visitor 215ms vs Host 280ms -> Visitor wins (1-0)
        room.status = REACTION_STATES.GO;
        room.round.goAtMs = 20000;
        room = adjudicateReactionRound(room, {
            visitorTap: { role: 'visitor', serverAtMs: 20215, clientAtMs: 20215, clockOffsetMs: 0 },
            hostTap: { role: 'host', serverAtMs: 20280, clientAtMs: 20280, clockOffsetMs: 0 }
        });
        assert.equal(room.round.winner, 'visitor');
        assert.equal(room.round.visitorReactionMs, 215);
        assert.equal(room.visitor.score, 1);
        assert.equal(room.status, REACTION_STATES.ROUND_END);

        // Round 2: Visitor wins again (2-0) -> Match FINISHED
        room = advanceToNextReactionRound(room);
        assert.equal(room.currentRound, 2);
        room.status = REACTION_STATES.GO;
        room.round.goAtMs = 30000;
        room = adjudicateReactionRound(room, {
            visitorTap: { role: 'visitor', serverAtMs: 30190, clientAtMs: 30190, clockOffsetMs: 0 },
            hostTap: { role: 'host', serverAtMs: 30240, clientAtMs: 30240, clockOffsetMs: 0 }
        });
        assert.equal(room.status, REACTION_STATES.FINISHED);
        assert.equal(room.matchWinner, 'visitor');
        assert.equal(room.visitor.score, REACTION_BATTLE_CONFIG.WINS_NEEDED);

        // Rematch cleanly resets scores & round history
        const rematch = resetReactionForRematch(room);
        assert.equal(rematch.currentRound, 1);
        assert.equal(rematch.visitor.score, 0);
        assert.equal(rematch.host.score, 0);
        assert.equal(rematch.matchWinner, null);
        assert.equal(rematch.roundHistory.length, 0);
    });

    await t.test('5. Server-authoritative timestamp rejects spoofed client clocks', () => {
        const goAtMs = 50000;
        // Malicious client claims tap happened 500ms before server actually received it (>250ms drift)
        const authMs = resolveAuthoritativeTapMs({
            serverAtMs: 50320,
            clientAtMs: 49800,
            clockOffsetMs: 0
        }, goAtMs);
        assert.equal(authMs, 50320, 'Should discard spoofed client timestamp beyond 250ms window');
    });

    await t.test('6. Daily prize quota and multi-mode participation calculation', () => {
        const today = new Date().toISOString();
        const participants = [
            { mode: 'quiz', playedAt: today, sketchClaimed: true, stickerClaimed: true },
            { mode: 'reaction_battle', playedAt: today, sketchClaimed: false, stickerClaimed: true }
        ];
        const status = computeArcadeQuotaStatus(participants, { dailySketchQuota: 1, dailyStickerQuota: 50 });
        assert.equal(status.totalQuizPlays, 1);
        assert.equal(status.totalReactionPlays, 1);
        assert.equal(status.sketchQuotaExhausted, true);
        assert.equal(status.sketchRemaining, 0);
        assert.equal(status.stickerRemaining, 48);
    });
});
