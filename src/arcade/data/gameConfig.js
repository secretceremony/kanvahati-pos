/**
 * Kanvahati Arcade — Centralized Game Configuration (10 Final Challenges)
 * Based on Phase 0.5 Approved Specifications
 */

export const ARCADE_GLOBAL_RULES = {
    TIME_LIMIT_SECONDS: 30,
    MAX_PLAYS_PER_EVENT_PER_PERSON: 1,
    ALLOW_GOOGLE: false,
    ALLOW_FRIEND_HELP: false,
    ALLOW_EXTRA_HINTS: false,
    PRIZES: {
        WIN: {
            sketchCommission: true,
            stickerFreebie: true,
            description: "Free Frame Live Sketch Commission + Sticker Freebie"
        },
        LOSE: {
            sketchCommission: false,
            stickerFreebie: true,
            description: "Sticker Freebie"
        }
    }
};

// Admin configurable letter whitelist for G06 (excludes excessively rare letters: Q, V, X, Z)
export const DEFAULT_ALPHABET_WHITELIST = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'M', 'N', 'R', 'S', 'T', 'Y'];

export const GAME_DEFINITIONS = {
    G01: {
        id: 'G01',
        title: 'Anime Speedrun',
        targetCount: 10,
        evalType: 'verbal_counter_franchise',
        timeLimitSec: 30,
        displayInstruction: 'Sebutkan 10 judul anime berbeda secara lisan!',
        hostInstruction: 'Hitung judul anime yang valid. Catatan: Season/sequel dari franchise yang sama hanya dihitung 1 judul.',
        rulesNote: 'Season atau sequel franchise yang sama (misal: Naruto & Naruto Shippuden) dihitung sebagai 1 anime.'
    },
    G02: {
        id: 'G02',
        title: 'Character Hunt',
        targetCount: 5,
        evalType: 'verbal_counter_trait',
        timeLimitSec: 30,
        displayInstruction: 'Sebutkan 5 karakter anime dengan ciri yang ditentukan!',
        hostInstruction: 'Hitung karakter yang memenuhi kriteria ciri fisik/atribut.',
        rulesNote: 'Karakter harus berasal dari anime yang valid dan memiliki ciri yang ditentukan.'
    },
    G03: {
        id: 'G03',
        title: 'Anime Genre Explorer',
        targetCount: 3,
        evalType: 'genre_examples',
        timeLimitSec: 30,
        displayInstruction: 'Sebutkan 3 genre anime berbeda beserta 1 contoh anime untuk tiap genre tersebut!',
        hostInstruction: 'Validasi 3 genre anime berbeda dan 1 contoh anime valid untuk tiap genre.',
        rulesNote: 'Sebutkan 3 genre berbeda (contoh: Isekai, Shounen, Mecha) dan berikan minimal 1 contoh anime yang tepat untuk tiap genre.'
    },
    G04: {
        id: 'G04',
        title: 'Guess the Anime: Cropped Edition',
        targetCount: 1,
        evalType: 'cropped_image',
        timeLimitSec: 30,
        displayInstruction: 'Tebak judul anime dari potongan gambar yang ditampilkan!',
        hostInstruction: 'Cocokkan tebakan peserta dengan kunci jawaban resmi / alternatif judul.',
        rulesNote: 'Judul bahasa Jepang, Inggris, atau Indonesia yang diakui resmi dinyatakan benar.'
    },
    G05: {
        id: 'G05',
        title: 'Guess the Anime Opening',
        targetCount: 1,
        evalType: 'audio_clip',
        timeLimitSec: 30,
        displayInstruction: 'Dengarkan klip audio pembuka anime (maksimal 5 detik) dan tebak judul anime-nya!',
        hostInstruction: 'Putar klip YouTube 5 detik, lalu validasi tebakan judul anime peserta.',
        rulesNote: 'Peserta harus menyebutkan judul anime yang benar dalam 30 detik.'
    },
    G06: {
        id: 'G06',
        title: 'Character Alphabet Rush',
        targetCount: 5,
        evalType: 'alphabet_rush',
        timeLimitSec: 30,
        displayInstruction: 'Sebutkan 5 karakter anime yang diawali dengan huruf yang ditentukan!',
        hostInstruction: 'Hitung 5 karakter valid dengan huruf awalan aktif. Karakter tidak boleh diulang.',
        rulesNote: 'Huruf dipilih secara acak dari whitelist yang disetujui admin.'
    },
    G07: {
        id: 'G07',
        title: 'Three-Hint Character',
        targetCount: 1,
        evalType: 'host_three_hints',
        timeLimitSec: 30,
        displayInstruction: 'Dengarkan maksimal 3 ciri-ciri karakter dari panitia, lalu tebak siapa karakternya!',
        hostInstruction: 'Bacakan maksimal 3 petunjuk/ciri khas di layar host satu per satu. Peserta menebak nama karakter sebelum 30 detik.',
        rulesNote: 'Peserta menebak nama karakter berdasarkan petunjuk panitia. 1 tebakan salah langsung kalah.'
    },
    G08: {
        id: 'G08',
        title: 'Act Like That Character!',
        targetCount: 1,
        evalType: 'pose_demonstration',
        timeLimitSec: 30,
        displayInstruction: 'Tirukan pose atau gaya karakter anime yang muncul di layar!',
        hostInstruction: 'Evaluasi keberhasilan pose/gaya karakter ikonik (JoJo, JJK, Himmel, dll).',
        rulesNote: 'Demonstrasi dinyatakan berhasil jika gerakan atau pose khas karakter tertirukan dengan jelas.'
    },
    G09: {
        id: 'G09',
        title: 'Find the Impostor: Character Edition',
        targetCount: 1,
        evalType: 'impostor_character',
        timeLimitSec: 30,
        displayInstruction: 'Cari 1 karakter yang berasal dari anime/franchise berbeda di antara 5 karakter berikut!',
        hostInstruction: 'Cocokkan nomor kartu/karakter yang ditunjuk peserta dengan impostor rahasia.',
        rulesNote: '4 karakter berasal dari franchise yang sama, 1 karakter adalah impostor.'
    },
    G10: {
        id: 'G10',
        title: 'Find the Impostor: Anime Edition',
        targetCount: 1,
        evalType: 'impostor_anime',
        timeLimitSec: 30,
        displayInstruction: 'Cari 1 judul anime fiktif (palsu) di antara 5 judul berikut!',
        hostInstruction: 'Cocokkan judul pilihan peserta dengan judul fiktif rahasia.',
        rulesNote: '4 judul adalah anime asli yang pernah rilis, 1 judul adalah karangan fiktif (tingkat kesulitan medium/hard).'
    }
};
