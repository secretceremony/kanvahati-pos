/**
 * Kanvahati Arcade — Data Layer Service (arcadeDb.js)
 * Manages Firestore interactions for Events, Stations, Questions, Secrets, Sessions, and Participants.
 */

import { db } from '../../firebase.js';
import { 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    collection, 
    getDocs, 
    query, 
    where, 
    runTransaction, 
    serverTimestamp,
    onSnapshot 
} from 'firebase/firestore';
import { INITIAL_QUESTIONS, INITIAL_SECRETS } from '../data/initialQuestionBank.js';
import { DEFAULT_EVENT_ARCADE_CONFIG } from '../data/gameConfig.js';

/**
 * Hash participant identifier for Minimal PII (SHA-256 equivalent in browser/node)
 */
export async function hashIdentifier(rawIdentifier) {
    if (!rawIdentifier) return "anonymous";
    let clean = rawIdentifier.trim().toLowerCase();
    
    // Normalize phone numbers: if it consists of digits, hyphens, spaces, plus, parentheses
    const digitsOnly = clean.replace(/[\s\-().]/g, '');
    if (/^\+?\d{8,15}$/.test(digitsOnly)) {
        clean = digitsOnly;
    }
    
    // Use Web Crypto API if available, or lightweight fallback for hash consistency
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        const msgUint8 = new TextEncoder().encode(clean);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
    } else {
        // Simple deterministic djb2 hash string representation for Node test environments
        let hash = 5381;
        for (let i = 0; i < clean.length; i++) {
            hash = ((hash << 5) + hash) + clean.charCodeAt(i);
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).padStart(16, '0');
    }
}

/**
 * Seed initial Question Bank and Secrets to Firestore if empty
 */
export async function seedQuestionBankIfEmpty(force = false) {
    try {
        const questionsSnap = await getDocs(collection(db, "arcade_questions"));
        if (questionsSnap.empty || questionsSnap.size < INITIAL_QUESTIONS.length || force) {
            console.log("Seeding / updating initial arcade questions and secrets...");
            const existingIds = new Set();
            questionsSnap.forEach(d => existingIds.add(d.id));

            for (const q of INITIAL_QUESTIONS) {
                if (force || !existingIds.has(q.id) || ['G03', 'G05', 'G07', 'G08', 'G10'].includes(q.gameId)) {
                    await setDoc(doc(db, "arcade_questions", q.id), q);
                }
            }
            for (const s of INITIAL_SECRETS) {
                if (force || !existingIds.has(s.id) || ['G03', 'G05', 'G07', 'G08', 'G10'].includes(s.gameId)) {
                    await setDoc(doc(db, "arcade_secrets", s.id), s);
                }
            }
            return true;
        }
        return false;
    } catch (e) {
        console.warn("Seeding question bank skipped or failed:", e);
        return false;
    }
}

/**
 * Fetch all active questions for a given challenge or all challenges (Public Metadata Only)
 */
export async function getQuestions(gameId = null) {
    try {
        let qRef = collection(db, "arcade_questions");
        let querySnapshot;
        if (gameId) {
            const q = query(qRef, where("gameId", "==", gameId), where("status", "==", "active"));
            querySnapshot = await getDocs(q);
        } else {
            querySnapshot = await getDocs(qRef);
        }

        const questions = [];
        querySnapshot.forEach(docSnap => {
            questions.push(docSnap.data());
        });

        // Fallback to initial questions if empty
        if (questions.length === 0) {
            return gameId ? INITIAL_QUESTIONS.filter(q => q.gameId === gameId) : [...INITIAL_QUESTIONS];
        }
        return questions;
    } catch (e) {
        console.warn("Fetch questions from Firestore failed, using static fallback:", e);
        return gameId ? INITIAL_QUESTIONS.filter(q => q.gameId === gameId) : [...INITIAL_QUESTIONS];
    }
}

/**
 * Fetch secret answer key for a question (RESTRICTED: Host & Admin Only)
 */
export async function getQuestionSecret(questionId) {
    if (!questionId) return null;
    try {
        const secretDocRef = doc(db, "arcade_secrets", questionId);
        const secretDoc = await getDoc(secretDocRef);
        if (secretDoc.exists()) {
            return secretDoc.data();
        }
        // Fallback to initial secrets
        return INITIAL_SECRETS.find(s => s.id === questionId) || null;
    } catch (e) {
        console.warn("Fetch secret from Firestore failed, using fallback:", e);
        return INITIAL_SECRETS.find(s => s.id === questionId) || null;
    }
}

/**
 * Fetch all questions (both active and inactive) for Question Bank Management (Admin/Host)
 */
export async function getAllQuestionsAdmin(gameId = null) {
    try {
        let qRef = collection(db, "arcade_questions");
        let querySnapshot;
        if (gameId) {
            const q = query(qRef, where("gameId", "==", gameId));
            querySnapshot = await getDocs(q);
        } else {
            querySnapshot = await getDocs(qRef);
        }

        const questions = [];
        querySnapshot.forEach(docSnap => {
            questions.push(docSnap.data());
        });

        if (questions.length === 0) {
            return gameId ? INITIAL_QUESTIONS.filter(q => q.gameId === gameId) : [...INITIAL_QUESTIONS];
        }
        return questions;
    } catch (e) {
        console.warn("Fetch admin questions from Firestore failed, fallback to initial:", e);
        return gameId ? INITIAL_QUESTIONS.filter(q => q.gameId === gameId) : [...INITIAL_QUESTIONS];
    }
}

/**
 * Save or update a question and its secret answer key in Firestore
 */
export async function saveQuestion(questionData, secretData = null) {
    if (!questionData || !questionData.id) {
        throw new Error("INVALID_QUESTION_DATA: ID soal wajib diisi!");
    }

    const qRef = doc(db, "arcade_questions", questionData.id);
    const payload = {
        ...questionData,
        updatedAt: new Date().toISOString()
    };
    await setDoc(qRef, payload, { merge: true });

    if (secretData) {
        const sRef = doc(db, "arcade_secrets", questionData.id);
        const secretPayload = {
            id: questionData.id,
            gameId: questionData.gameId,
            ...secretData,
            updatedAt: new Date().toISOString()
        };
        await setDoc(sRef, secretPayload, { merge: true });
    }

    return payload;
}

/**
 * Toggle question status between active and inactive
 */
export async function toggleQuestionStatus(questionId, newStatus) {
    const qRef = doc(db, "arcade_questions", questionId);
    await updateDoc(qRef, {
        status: newStatus,
        updatedAt: new Date().toISOString()
    });
    return { questionId, status: newStatus };
}

/**
 * Get active session for a specific Event and Station
 */
export async function getActiveSession(eventId, stationId) {
    const stationKey = `${eventId}_${stationId}`;
    try {
        const sessionDocRef = doc(db, "arcade_sessions", stationKey);
        const sessionDoc = await getDoc(sessionDocRef);
        if (sessionDoc.exists()) {
            return sessionDoc.data();
        }
        return null;
    } catch (e) {
        console.error("Error reading active session:", e);
        return null;
    }
}

/**
 * Update or set active session state in Firestore
 */
export async function updateSessionState(eventId, stationId, sessionPayload) {
    const stationKey = `${eventId}_${stationId}`;
    const sessionDocRef = doc(db, "arcade_sessions", stationKey);
    const nowMs = Date.now();

    const payloadWithMeta = {
        stationKey,
        eventId,
        stationId,
        ...sessionPayload,
        updatedAt: serverTimestamp(),
        updatedAtMs: nowMs
    };

    await setDoc(sessionDocRef, payloadWithMeta, { merge: true });
    return payloadWithMeta;
}

/**
 * Get Event Arcade Config (maxPlaysPerParticipant, daily quotas, mode toggles)
 */
export async function getEventArcadeConfig(eventId = 'CF20') {
    const cleanEvent = (eventId || 'CF20').trim().toUpperCase();
    try {
        const cfgSnap = await getDoc(doc(db, 'arcade_event_config', cleanEvent));
        if (cfgSnap.exists()) {
            return { ...DEFAULT_EVENT_ARCADE_CONFIG, ...cfgSnap.data(), eventId: cleanEvent };
        }
    } catch (e) {
        console.warn('getEventArcadeConfig fallback:', e);
    }
    return { ...DEFAULT_EVENT_ARCADE_CONFIG, eventId: cleanEvent };
}

/**
 * Save Event Arcade Config (Admin / Host)
 */
export async function saveEventArcadeConfig(eventId, configUpdates) {
    const cleanEvent = (eventId || 'CF20').trim().toUpperCase();
    const payload = {
        ...DEFAULT_EVENT_ARCADE_CONFIG,
        ...configUpdates,
        eventId: cleanEvent,
        updatedAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'arcade_event_config', cleanEvent), payload, { merge: true });
    return payload;
}

/**
 * Compute daily & event quota usage from participant list
 */
export function computeArcadeQuotaStatus(participants = [], eventConfig = DEFAULT_EVENT_ARCADE_CONFIG) {
    const todayKey = new Date().toISOString().slice(0, 10);
    let sketchUsedToday = 0;
    let stickerUsedToday = 0;
    let totalQuizPlays = 0;
    let totalReactionPlays = 0;

    participants.forEach((p) => {
        const playedDay = (p.playedAt || '').slice(0, 10);
        if (p.mode === 'reaction_battle') totalReactionPlays++;
        else totalQuizPlays++;

        if (playedDay === todayKey) {
            if (p.sketchClaimed) sketchUsedToday++;
            if (p.stickerClaimed) stickerUsedToday++;
        }
    });

    const sketchQuota = Number(eventConfig?.dailySketchQuota ?? DEFAULT_EVENT_ARCADE_CONFIG.dailySketchQuota);
    const stickerQuota = Number(eventConfig?.dailyStickerQuota ?? DEFAULT_EVENT_ARCADE_CONFIG.dailyStickerQuota);

    return {
        todayKey,
        sketchUsedToday,
        sketchQuota,
        sketchRemaining: Math.max(0, sketchQuota - sketchUsedToday),
        sketchQuotaExhausted: sketchUsedToday >= sketchQuota,
        stickerUsedToday,
        stickerQuota,
        stickerRemaining: Math.max(0, stickerQuota - stickerUsedToday),
        stickerQuotaExhausted: stickerUsedToday >= stickerQuota,
        totalQuizPlays,
        totalReactionPlays
    };
}

/**
 * Atomically register a participant and activate session in a single Firestore transaction.
 * Supports configurable maxPlaysPerParticipant (default 1, backward compatible with existing docs)
 * and tracks mode ('quiz' | 'reaction_battle').
 */
export async function startSessionAtomic(eventId, stationId, rawIdentifier, displayName, gameId, sessionPayload) {
    const hashed = await hashIdentifier(rawIdentifier);
    const participantKey = `${eventId}_${hashed}`;
    const stationKey = `${eventId}_${stationId}`;
    const participantDocRef = doc(db, "arcade_participants", participantKey);
    const sessionDocRef = doc(db, "arcade_sessions", stationKey);
    const cfgDocRef = doc(db, "arcade_event_config", (eventId || 'CF20').trim().toUpperCase());

    return await runTransaction(db, async (transaction) => {
        const [existingDoc, cfgSnap] = await Promise.all([
            transaction.get(participantDocRef),
            transaction.get(cfgDocRef)
        ]);
        const maxPlays = Number(cfgSnap.exists() ? (cfgSnap.data().maxPlaysPerParticipant ?? 1) : 1);

        let prevPlayCount = 0;
        let prevModes = [];
        if (existingDoc.exists()) {
            const data = existingDoc.data();
            prevPlayCount = Number(data.playCount || 1);
            prevModes = Array.isArray(data.modesPlayed) ? data.modesPlayed : [data.mode || 'quiz'];
            if (prevPlayCount >= maxPlays) {
                const err = new Error(`ALREADY_PLAYED: Peserta '${data.displayName || displayName}' sudah mencapai batas bermain (${prevPlayCount}/${maxPlays}) pada event ini!`);
                err.code = 'ALREADY_PLAYED';
                err.playedAt = data.playedAt;
                throw err;
            }
        }

        const nowIso = new Date().toISOString();
        const nowMs = Date.now();
        const sessionId = sessionPayload.sessionId || `sess_${nowMs}_${Math.random().toString(36).substring(2, 7)}`;
        const mode = sessionPayload.mode || 'quiz';

        const newRecord = {
            participantKey,
            eventId,
            stationId,
            displayName: displayName.trim(),
            hashedIdentifier: hashed,
            gameId,
            mode,
            modesPlayed: Array.from(new Set([...prevModes, mode])),
            playCount: prevPlayCount + 1,
            difficulty: sessionPayload.difficulty || 'normal',
            quizMode: sessionPayload.quizMode || 'classic',
            sessionId,
            playedAt: nowIso,
            status: "in_progress",
            result: null, // "win" | "lose"
            sketchClaimed: existingDoc.exists() ? Boolean(existingDoc.data().sketchClaimed) : false,
            sketchClaimedAt: existingDoc.exists() ? (existingDoc.data().sketchClaimedAt || null) : null,
            stickerClaimed: existingDoc.exists() ? Boolean(existingDoc.data().stickerClaimed) : false,
            stickerClaimedAt: existingDoc.exists() ? (existingDoc.data().stickerClaimedAt || null) : null
        };

        const sessionData = {
            stationKey,
            eventId,
            stationId,
            sessionId,
            revision: sessionPayload.revision || 1,
            ...sessionPayload,
            startedAt: serverTimestamp(),
            startedAtMs: nowMs,
            updatedAt: serverTimestamp(),
            updatedAtMs: nowMs
        };

        transaction.set(participantDocRef, newRecord, { merge: true });
        transaction.set(sessionDocRef, sessionData, { merge: true });

        return { participant: newRecord, session: sessionData };
    });
}

/**
 * Atomically register a participant and prevent playing more than once per event.
 * Uses transactional document write with unique deterministic key: {eventId}_{hashedIdentifier}
 */
export async function registerParticipantAtomic(eventId, stationId, rawIdentifier, displayName, gameId) {
    const hashed = await hashIdentifier(rawIdentifier);
    const participantKey = `${eventId}_${hashed}`;
    const participantDocRef = doc(db, "arcade_participants", participantKey);

    return await runTransaction(db, async (transaction) => {
        const existingDoc = await transaction.get(participantDocRef);
        if (existingDoc.exists()) {
            const data = existingDoc.data();
            const err = new Error(`ALREADY_PLAYED: Peserta '${data.displayName || displayName}' sudah pernah bermain pada event ini!`);
            err.code = 'ALREADY_PLAYED';
            err.playedAt = data.playedAt;
            throw err;
        }

        const newRecord = {
            participantKey,
            eventId,
            stationId,
            displayName: displayName.trim(),
            hashedIdentifier: hashed,
            gameId,
            playedAt: new Date().toISOString(),
            status: "in_progress",
            result: null, // "win" | "lose"
            sketchClaimed: false,
            sketchClaimedAt: null,
            stickerClaimed: false,
            stickerClaimedAt: null
        };

        transaction.set(participantDocRef, newRecord);
        return newRecord;
    });
}

/**
 * Atomically record game outcome (win/lose) and update prize eligibility
 * Supports multiple plays when maxPlaysPerParticipant > 1 without blocking replay outcome updates.
 */
export async function recordGameOutcome(eventId, rawIdentifier, result, staffUid = "host_operator", meta = {}) {
    const hashed = await hashIdentifier(rawIdentifier);
    const participantKey = `${eventId}_${hashed}`;
    const participantDocRef = doc(db, "arcade_participants", participantKey);

    return await runTransaction(db, async (transaction) => {
        const participantDoc = await transaction.get(participantDocRef);
        if (!participantDoc.exists()) {
            throw new Error("PARTICIPANT_NOT_FOUND: Data peserta tidak ditemukan!");
        }

        const data = participantDoc.data();
        if (data.result !== null && data.sessionId && meta.sessionId && data.sessionId === meta.sessionId) {
            throw new Error("RESULT_FINALIZED: Hasil permainan sesi ini sudah final dan tidak dapat diubah!");
        }
        if (data.result !== null && !meta.allowReplayUpdate) {
            throw new Error("RESULT_FINALIZED: Hasil permainan peserta ini sudah final dan tidak dapat diubah!");
        }

        const updates = {
            result, // "win" | "lose"
            status: result === 'win' ? 'won' : 'lost',
            completedAt: new Date().toISOString(),
            evaluatedByStaff: staffUid,
            // Everyone gets sticker freebie by default
            stickerClaimed: true,
            stickerClaimedAt: data.stickerClaimedAt || new Date().toISOString()
        };

        transaction.update(participantDocRef, updates);
        return { ...data, ...updates };
    });
}

/**
 * Atomically claim live sketch commission prize (enforces daily event quota if configured)
 */
export async function claimSketchPrize(eventId, rawIdentifier) {
    const hashed = await hashIdentifier(rawIdentifier);
    const participantKey = `${eventId}_${hashed}`;
    const participantDocRef = doc(db, "arcade_participants", participantKey);
    const cfgDocRef = doc(db, 'arcade_event_config', (eventId || 'CF20').trim().toUpperCase());

    return await runTransaction(db, async (transaction) => {
        const [participantDoc, cfgSnap] = await Promise.all([
            transaction.get(participantDocRef),
            transaction.get(cfgDocRef)
        ]);
        if (!participantDoc.exists()) {
            throw new Error("PARTICIPANT_NOT_FOUND");
        }

        const data = participantDoc.data();
        if (data.result !== 'win') {
            throw new Error("NOT_ELIGIBLE: Hanya pemenang yang berhak mengklaim live sketch commission!");
        }
        if (data.sketchClaimed) {
            throw new Error("ALREADY_CLAIMED: Hadiah live sketch commission sudah diklaim sebelumnya!");
        }

        if (cfgSnap.exists()) {
            const quota = Number(cfgSnap.data().dailySketchQuota ?? DEFAULT_EVENT_ARCADE_CONFIG.dailySketchQuota);
            const todayKey = new Date().toISOString().slice(0, 10);
            const usedToday = Number(cfgSnap.data()[`sketchUsed_${todayKey}`] || 0);
            if (usedToday >= quota) {
                throw new Error(`QUOTA_EXHAUSTED: Kuota harian Live Sketch (${quota}/hari) sudah habis!`);
            }
            transaction.set(cfgDocRef, { [`sketchUsed_${todayKey}`]: usedToday + 1 }, { merge: true });
        }

        const updates = {
            sketchClaimed: true,
            sketchClaimedAt: new Date().toISOString()
        };

        transaction.update(participantDocRef, updates);
        return { ...data, ...updates };
    });
}

/**
 * Check whether participant has already played in the given event
 */
export async function checkParticipantStatus(eventId, rawIdentifier) {
    if (!rawIdentifier || !rawIdentifier.trim()) {
        return { hasPlayed: false, record: null, participantKey: null };
    }
    const hashed = await hashIdentifier(rawIdentifier);
    const participantKey = `${eventId}_${hashed}`;
    const participantDocRef = doc(db, "arcade_participants", participantKey);

    try {
        const docSnap = await getDoc(participantDocRef);
        if (docSnap.exists()) {
            return { hasPlayed: true, record: docSnap.data(), participantKey };
        }
        return { hasPlayed: false, record: null, participantKey };
    } catch (e) {
        console.warn("Check participant status failed, assuming unplayed in local mode:", e);
        return { hasPlayed: false, record: null, participantKey };
    }
}

/**
 * Update sticker freebie claim status
 */
export async function claimStickerPrize(eventId, rawIdentifier) {
    const hashed = await hashIdentifier(rawIdentifier);
    const participantKey = `${eventId}_${hashed}`;
    const participantDocRef = doc(db, "arcade_participants", participantKey);

    return await updateDoc(participantDocRef, {
        stickerClaimed: true,
        stickerClaimedAt: new Date().toISOString()
    });
}

/**
 * Fetch all participants who have played in an event (Host / Admin Only)
 */
export async function getEventParticipants(eventId) {
    if (!eventId) return [];
    try {
        const q = query(
            collection(db, "arcade_participants"),
            where("eventId", "==", eventId)
        );
        const snap = await getDocs(q);
        const list = [];
        snap.forEach(docSnap => {
            list.push({ id: docSnap.id, ...docSnap.data() });
        });
        // Client-side sort prevents needing composite Firestore indexes
        list.sort((a, b) => new Date(b.playedAt || 0) - new Date(a.playedAt || 0));
        return list;
    } catch (e) {
        console.warn("getEventParticipants failed:", e);
        return [];
    }
}

/**
 * Subscribe in real-time to participants who have played in an event
 */
export function subscribeEventParticipants(eventId, onUpdate, onError) {
    if (!eventId) return () => {};
    try {
        const q = query(
            collection(db, "arcade_participants"),
            where("eventId", "==", eventId)
        );
        return onSnapshot(q, (snapshot) => {
            const list = [];
            snapshot.forEach(docSnap => {
                list.push({ id: docSnap.id, ...docSnap.data() });
            });
            list.sort((a, b) => new Date(b.playedAt || 0) - new Date(a.playedAt || 0));
            onUpdate(list);
        }, (err) => {
            console.warn("subscribeEventParticipants error:", err);
            onError?.(err);
        });
    } catch (e) {
        console.warn("subscribeEventParticipants failed to initialize:", e);
        return () => {};
    }
}

/**
 * Claim live sketch prize directly by participantKey (used in admin table)
 */
export async function claimSketchPrizeByKey(participantKey) {
    if (!participantKey) throw new Error("INVALID_KEY");
    const participantDocRef = doc(db, "arcade_participants", participantKey);
    const eventId = participantKey.split('_')[0] || 'CF20';
    const cfgDocRef = doc(db, 'arcade_event_config', eventId.toUpperCase());

    return await runTransaction(db, async (transaction) => {
        const [docSnap, cfgSnap] = await Promise.all([
            transaction.get(participantDocRef),
            transaction.get(cfgDocRef)
        ]);
        if (!docSnap.exists()) throw new Error("PARTICIPANT_NOT_FOUND");
        const data = docSnap.data();
        if (data.result !== 'win') throw new Error("NOT_ELIGIBLE: Hanya pemenang yang berhak!");
        if (data.sketchClaimed) throw new Error("ALREADY_CLAIMED: Sudah diklaim sebelumnya!");

        if (cfgSnap.exists()) {
            const quota = Number(cfgSnap.data().dailySketchQuota ?? DEFAULT_EVENT_ARCADE_CONFIG.dailySketchQuota);
            const todayKey = new Date().toISOString().slice(0, 10);
            const usedToday = Number(cfgSnap.data()[`sketchUsed_${todayKey}`] || 0);
            if (usedToday >= quota) {
                throw new Error(`QUOTA_EXHAUSTED: Kuota harian Live Sketch (${quota}/hari) sudah habis!`);
            }
            transaction.set(cfgDocRef, { [`sketchUsed_${todayKey}`]: usedToday + 1 }, { merge: true });
        }

        const updates = {
            sketchClaimed: true,
            sketchClaimedAt: new Date().toISOString()
        };
        transaction.update(participantDocRef, updates);
        return { ...data, ...updates };
    });
}

