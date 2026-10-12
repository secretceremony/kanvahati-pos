import fs from 'fs';

// =========================================================================
// G01: Anime Speedrun — Bebas Apa Saja, Tanpa Batasan Tema/Genre
// =========================================================================
const g01Questions = [
    {
        id: "Q-G01-001",
        gameId: "G01",
        gameTitle: "Anime Speedrun",
        displayPrompt: "Sebutkan 10 judul anime bebas apa saja secara lisan dalam waktu 30 detik!",
        rulesDetail: "Judul bebas tanpa batasan genre atau tema. Season/sequel franchise yang sama hanya dihitung 1 judul.",
        targetCount: 10,
        status: "active",
        createdAt: "2026-10-10T00:00:00Z"
    },
    {
        id: "Q-G01-002",
        gameId: "G01",
        gameTitle: "Anime Speedrun",
        displayPrompt: "Sebutkan 10 judul anime bebas apa saja yang kamu ketahui dalam waktu 30 detik!",
        rulesDetail: "Judul bebas tanpa batasan genre. Sequel dari franchise yang sama hanya dihitung 1 judul.",
        targetCount: 10,
        status: "active",
        createdAt: "2026-10-10T00:00:00Z"
    },
    {
        id: "Q-G01-003",
        gameId: "G01",
        gameTitle: "Anime Speedrun",
        displayPrompt: "Sebutkan 10 judul anime favorit atau bebas secara cepat sebelum waktu 30 detik habis!",
        rulesDetail: "Judul anime apa pun diperbolehkan. Tidak boleh mengulang judul dalam franchise yang sama.",
        targetCount: 10,
        status: "active",
        createdAt: "2026-10-10T00:00:00Z"
    },
    {
        id: "Q-G01-004",
        gameId: "G01",
        gameTitle: "Anime Speedrun",
        displayPrompt: "Sebutkan 10 judul anime bebas apa saja secara lisan (tidak ada batasan tema)!",
        rulesDetail: "Bebas anime apa saja (TV, Movie, OVA). Season berbeda dari anime yang sama hanya dihitung 1.",
        targetCount: 10,
        status: "active",
        createdAt: "2026-10-10T00:00:00Z"
    },
    {
        id: "Q-G01-005",
        gameId: "G01",
        gameTitle: "Anime Speedrun",
        displayPrompt: "Tantangan Kecepatan: Sebutkan 10 judul anime bebas apa saja dalam 30 detik!",
        rulesDetail: "Bebas anime apa saja. Pastikan 10 judul berbeda.",
        targetCount: 10,
        status: "active",
        createdAt: "2026-10-10T00:00:00Z"
    }
];

const g01Secrets = g01Questions.map(q => ({
    id: q.id,
    gameId: "G01",
    guidelines: "Hitung 10 judul anime valid secara lisan tanpa batasan genre/tema. Season/sequel franchise yang sama hanya dihitung 1."
}));

// =========================================================================
// G02: Character Hunt — 10 Trait & Appearance Questions
// =========================================================================
const g02Traits = [
    {
        trait: "Rambut Putih atau Perak",
        answers: ["Satoru Gojo", "Kakashi Hatake", "Killua Zoldyck", "Ken Kaneki", "Gintoki Sakata", "Frieren", "Near", "Inuyasha", "Jiraiya", "Toshiro Hitsugaya", "Kanade Tachibana", "Shiro (No Game No Life)"]
    },
    {
        trait: "Memakai Penutup Mata (Eyepatch) atau Perban di Mata",
        answers: ["Kakashi Hatake", "Ken Kaneki", "Megumin", "Ciel Phantomhive", "Kenpachi Zaraki", "Mei Misaki", "Rikka Takanashi", "Hange Zoe", "King Bradley"]
    },
    {
        trait: "Memiliki Bekas Luka (Scar) di Wajah atau Tubuh",
        answers: ["Monkey D. Luffy", "Shoto Todoroki", "Tanjiro Kamado", "Kenshin Himura", "Shanks", "Guts", "Scar (Fullmetal Alchemist)", "Yamcha", "Zoro"]
    },
    {
        trait: "Bertubuh Kecil / Pendek tetapi Sangat Kuat (Overpowered)",
        answers: ["Levi Ackerman", "Edward Elric", "Meliodas", "Frieren", "Hiei", "Krillin", "Tatsumaki", "Sinbad (Magi)", "Tanya Degurechaff"]
    },
    {
        trait: "Selalu Memakai Topi (Topi Jerami, Pet, Beanie, dll)",
        answers: ["Monkey D. Luffy", "Tony Tony Chopper", "Kisuke Urahara", "Jotaro Kujo", "Ash Ketchum", "Trafalgar Law", "Megumin", "Kite (HxH)"]
    },
    {
        trait: "Memakai Kacamata (Megane / Kacamata Bulat / Hitam)",
        answers: ["Conan Edogawa", "Shinpachi Shimura", "Uryu Ishida", "Satoru Gojo", "Ranpo Edogawa", "Gendo Ikari", "Kabuto Yakushi", "Kyoya Ootori", "Miyuki Kazuya"]
    },
    {
        trait: "Rambut Kuning / Pirang Berduri atau Ikonik",
        answers: ["Naruto Uzumaki", "Son Goku", "Katsuki Bakugo", "Edward Elric", "Zenitsu Agatsuma", "Denji", "Sanji", "Kurapika", "Sailor Moon"]
    },
    {
        trait: "Karakter yang Selalu Makan Banyak / Rakus (Glutton)",
        answers: ["Monkey D. Luffy", "Son Goku", "Sasha Blouse", "Gluttony (FMA)", "Choji Akimichi", "Kagura (Gintama)", "Toriko", "Vash the Stampede"]
    },
    {
        trait: "Memiliki Sayap (Malaikat, Iblis, atau Burung)",
        answers: ["Hawks (MHA)", "Ulquiorra Cifer", "Ryuk (Death Note)", "Albedo (Overlord)", "Lucifer (Devil is a Part-Timer)", "Pitou", "Kanade Tachibana"]
    },
    {
        trait: "Memakai Mantel / Jubah Hitam Ikonik",
        answers: ["Kirito (SAO)", "Levi Ackerman (Survey Corps)", "Itachi Uchiha (Akatsuki)", "Lelouch vi Britannia (Zero)", "Rimuru Tempest", "Ainz Ooal Gown", "Chuuya Nakahara"]
    }
];

const g02Questions = g02Traits.map((t, i) => ({
    id: `Q-G02-${String(i + 1).padStart(3, '0')}`,
    gameId: "G02",
    gameTitle: "Character Hunt",
    displayPrompt: `Sebutkan 5 karakter anime yang memiliki ciri: ${t.trait}!`,
    trait: t.trait,
    targetCount: 5,
    status: "active",
    createdAt: "2026-10-10T00:00:00Z"
}));

const g02Secrets = g02Questions.map((q, i) => ({
    id: q.id,
    gameId: "G02",
    trait: q.trait,
    referenceAnswers: g02Traits[i].answers
}));

// =========================================================================
// G03: Anime Genre Explorer (3 Genre & Anime Contoh) — 5 Questions
// =========================================================================
const g03Questions = [
    {
        id: "Q-G03-001",
        gameId: "G03",
        gameTitle: "Anime Genre Explorer",
        displayPrompt: "Sebutkan 3 genre anime berbeda beserta 1 contoh anime untuk tiap genre tersebut!",
        rulesDetail: "Contoh: Isekai -> Re:Zero, Shounen -> Naruto, Romance -> Kaguya-sama.",
        targetCount: 3,
        status: "active",
        createdAt: "2026-10-10T00:00:00Z"
    },
    {
        id: "Q-G03-002",
        gameId: "G03",
        gameTitle: "Anime Genre Explorer",
        displayPrompt: "Sebutkan 3 genre anime bertema Action / Petualangan / Supernatural serta berikan 1 contoh anime untuk tiap genre!",
        rulesDetail: "Contoh: Shounen Action -> Jujutsu Kaisen, Dark Fantasy -> Berserk, Supernatural -> Bleach.",
        targetCount: 3,
        status: "active",
        createdAt: "2026-10-10T00:00:00Z"
    },
    {
        id: "Q-G03-003",
        gameId: "G03",
        gameTitle: "Anime Genre Explorer",
        displayPrompt: "Sebutkan 3 genre anime bertema Kehidupan / Perasaan (Romance / Slice of Life / Drama / Komedi) serta contoh animenya!",
        rulesDetail: "Contoh: Rom-Com -> Horimiya, Slice of Life -> Yuru Camp, Drama -> Koe no Katachi.",
        targetCount: 3,
        status: "active",
        createdAt: "2026-10-10T00:00:00Z"
    },
    {
        id: "Q-G03-004",
        gameId: "G03",
        gameTitle: "Anime Genre Explorer",
        displayPrompt: "Sebutkan 3 genre anime unik / sub-genre (Mecha, Psychological, Isekai, Iyashikei, Cyberpunk) serta contoh animenya!",
        rulesDetail: "Contoh: Mecha -> Gundam, Psychological -> Monster, Cyberpunk -> Psycho-Pass.",
        targetCount: 3,
        status: "active",
        createdAt: "2026-10-10T00:00:00Z"
    },
    {
        id: "Q-G03-005",
        gameId: "G03",
        gameTitle: "Anime Genre Explorer",
        displayPrompt: "Sebutkan 3 genre anime bertema Olahraga (Sports) / Musik / Sekolah serta berikan 1 contoh anime untuk tiap genre!",
        rulesDetail: "Contoh: Sports -> Haikyuu!!, Musik -> Bocchi the Rock!, School -> Classroom of the Elite.",
        targetCount: 3,
        status: "active",
        createdAt: "2026-10-10T00:00:00Z"
    }
];

const g03Secrets = g03Questions.map(q => ({
    id: q.id,
    gameId: "G03",
    rubricGuide: "Pastikan peserta menyebutkan 3 genre yang berbeda dan contoh anime yang tepat untuk tiap genre.",
    popularGenreReferences: {
        "Shounen / Action": ["Naruto", "One Piece", "Bleach", "Jujutsu Kaisen", "My Hero Academia"],
        "Isekai": ["Re:Zero", "That Time I Got Reincarnated as a Slime", "Mushoku Tensei", "Konosuba", "Overlord"],
        "Romance / Rom-Com": ["Kaguya-sama: Love is War", "Toradora!", "Horimiya", "Oregairu", "Clannad"],
        "Mecha": ["Mobile Suit Gundam", "Code Geass", "Neon Genesis Evangelion", "Gurren Lagann"],
        "Sports": ["Haikyuu!!", "Kuroko no Basket", "Blue Lock", "Slam Dunk", "Hajime no Ippo"],
        "Slice of Life": ["K-On!", "Yuru Camp", "Non Non Biyori", "Bocchi the Rock!", "Barakamon"],
        "Psychological / Thriller": ["Death Note", "Monster", "Steins;Gate", "Psycho-Pass", "Erased"],
        "Music": ["Bocchi the Rock!", "Your Lie in April", "K-On!", "Beck", "Hibike! Euphonium"],
        "Horror / Supernatural": ["Another", "Shiki", "Mieruko-chan", "Tokyo Ghoul", "Higurashi"]
    }
}));

// =========================================================================
// G04: Guess the Anime Cropped Edition (20 Questions - Real Assets)
// =========================================================================
const g04Data = [
    { file: "attack_on_titan.png", title: "Attack on Titan (Shingeki no Kyojin)", alts: ["Attack on Titan", "Shingeki no Kyojin", "AOT"] },
    { file: "blue_lock.png", title: "Blue Lock", alts: ["Blue Lock", "Bluelock"] },
    { file: "dandadan.png", title: "Dandadan", alts: ["Dandadan", "Dan Da Dan"] },
    { file: "dr_stone.png", title: "Dr. Stone", alts: ["Dr. Stone", "Doctor Stone"] },
    { file: "frieren.png", title: "Sousou no Frieren (Frieren: Beyond Journey's End)", alts: ["Frieren", "Sousou no Frieren", "Frieren Beyond Journeys End"] },
    { file: "jojo_starcrusader.png", title: "JoJo's Bizarre Adventure: Stardust Crusaders", alts: ["JoJo", "JoJo Bizarre Adventure", "Stardust Crusaders", "JoJo Part 3"] },
    { file: "jujutsu_kaisen.png", title: "Jujutsu Kaisen", alts: ["Jujutsu Kaisen", "JJK"] },
    { file: "kaguya_sama_love_is_war.png", title: "Kaguya-sama: Love is War", alts: ["Kaguya-sama", "Kaguya sama Love is War", "Kaguya sama"] },
    { file: "koe_no_katachi_a_silent_voice.png", title: "Koe no Katachi (A Silent Voice)", alts: ["A Silent Voice", "Koe no Katachi", "The Shape of Voice"] },
    { file: "kon.png", title: "K-On!", alts: ["K-On", "K-On!", "Keion"] },
    { file: "madoka_magica.png", title: "Puella Magi Madoka Magica", alts: ["Madoka Magica", "Mahou Shoujo Madoka Magica"] },
    { file: "one_piece.png", title: "One Piece", alts: ["One Piece", "OP"] },
    { file: "one_punch_man.png", title: "One Punch Man", alts: ["One Punch Man", "OPM", "Saitama"] },
    { file: "oshi_no_ko.png", title: "Oshi no Ko", alts: ["Oshi no Ko", "My Star"] },
    { file: "persona_5.png", title: "Persona 5 the Animation", alts: ["Persona 5", "P5", "Persona"] },
    { file: "suzume.png", title: "Suzume no Tojimari", alts: ["Suzume", "Suzume no Tojimari"] },
    { file: "takopi.png", title: "Takopi's Original Sin (Takopi no Genzai)", alts: ["Takopi", "Takopi no Genzai", "Takopis Original Sin"] },
    { file: "the_summer_hikaru_died.png", title: "Hikaru ga Shinda Natsu (The Summer Hikaru Died)", alts: ["The Summer Hikaru Died", "Hikaru ga Shinda Natsu"] },
    { file: "witch_hat_atelier.png", title: "Tongari Boushi no Atelier (Witch Hat Atelier)", alts: ["Witch Hat Atelier", "Tongari Boushi no Atelier"] },
    { file: "your_name_kimi_no_nawa.png", title: "Kimi no Na wa. (Your Name.)", alts: ["Your Name", "Kimi no Na wa", "Kimi no Nawa"] }
];

const g04Questions = g04Data.map((d, i) => ({
    id: `Q-G04-${String(i + 1).padStart(3, '0')}`,
    gameId: "G04",
    gameTitle: "Guess the Anime: Cropped Edition",
    displayPrompt: "Tebak judul anime dari potongan gambar berikut!",
    mediaUrl: `/arcade/guesses/${d.file}`,
    revealedMediaUrl: `/arcade/guesses/${d.file}`,
    targetCount: 1,
    status: "active",
    createdAt: "2026-10-10T00:00:00Z"
}));

const g04Secrets = g04Questions.map((q, i) => ({
    id: q.id,
    gameId: "G04",
    answerKey: g04Data[i].title,
    alternativeAnswers: g04Data[i].alts
}));

// =========================================================================
// G05: Guess the Anime Opening — User Requested 22 Iconic Tracks (Verified YouTube IDs)
// =========================================================================
const g05Songs = [
    { anime: "Tokyo Revengers", song: "Cry Baby - Official HIGE DANdism", ytId: "O1bhZgkC4Gw", start: 60 },
    { anime: "JoJo's Bizarre Adventure", song: "Sono Chi no Sadame - Hiroaki Tommy Tominaga", ytId: "1ZKAQzGYYSo", start: 45 },
    { anime: "Jujutsu Kaisen", song: "Kaikai Kitan - Eve", ytId: "v8bZVdTgXoY", start: 55 },
    { anime: "Beastars", song: "Kaibutsu (Monster) - YOASOBI", ytId: "dy90tA3TT1c", start: 40 },
    { anime: "Neon Genesis Evangelion", song: "A Cruel Angel's Thesis - Yoko Takahashi", ytId: "o6wtDPVkKqI", start: 35 },
    { anime: "My Hero Academia", song: "Peace Sign - Kenshi Yonezu", ytId: "yu0HjPzFYnY", start: 50 },
    { anime: "Chihayafuru", song: "YOUTHFUL - 99RadioService", ytId: "IcCJgmLZYkE", start: 40 },
    { anime: "Demon Slayer (Kimetsu no Yaiba)", song: "Gurenge - LiSA", ytId: "pmanD_s7G3U", start: 54 },
    { anime: "Hunter x Hunter", song: "departure! - Masatoshi Ono", ytId: "faqmNf_fZlE", start: 45 },
    { anime: "Attack on Titan (Shingeki no Kyojin)", song: "Guren no Yumiya - Linked Horizon", ytId: "8OkpRK2_gVs", start: 30 },
    { anime: "Uma Musume Pretty Derby", song: "Make debut! - Spica", ytId: "7t5LgFdV2q8", start: 40 },
    { anime: "Noragami Aragoto", song: "Kyouran Hey Kids!! - THE ORAL CIGARETTES", ytId: "C-o8pTi6vd8", start: 45 },
    { anime: "Domestic Girlfriend (Domestic na Kanojo)", song: "Kawaki wo Ameku - Minami", ytId: "0YF8vecQWYs", start: 55 },
    { anime: "No Game No Life", song: "This game - Konomi Suzuki", ytId: "6CBp4qylX6I", start: 50 },
    { anime: "Wotakoi: Love is Hard for Otaku", song: "Fiction - sumika", ytId: "XjHqfhOcK_0", start: 40 },
    { anime: "Dandadan", song: "Otonoke - Creepy Nuts", ytId: "a4na2opArGY", start: 45 },
    { anime: "Death Note", song: "The WORLD - Nightmare", ytId: "EtGhFQ88mjc", start: 45 },
    { anime: "Mashle: Magic and Muscles", song: "Bling-Bang-Bang-Born - Creepy Nuts", ytId: "210R0ozmLwg", start: 40 },
    { anime: "Fire Force (Enen no Shouboutai)", song: "Inferno - Mrs. GREEN APPLE", ytId: "wfCcs0vLysk", start: 45 },
    { anime: "Bocchi the Rock!", song: "Seishun Complex - Kessoku Band", ytId: "Fp8msa5uYsc", start: 40 },
    { anime: "Oshi no Ko", song: "Idol - YOASOBI", ytId: "ZRtdQ81jPUQ", start: 45 },
    { anime: "Chainsaw Man", song: "KICK BACK - Kenshi Yonezu", ytId: "M2cckDmNLMI", start: 48 }
];

const g05Questions = g05Songs.map((s, i) => ({
    id: `Q-G05-${String(i + 1).padStart(3, '0')}`,
    gameId: "G05",
    gameTitle: "Guess the Anime Opening",
    displayPrompt: "Dengarkan klip audio lagu pembuka anime (cuplikan 5 detik) dan tebak judul anime-nya!",
    youtubeId: s.ytId,
    startSeconds: s.start,
    endSeconds: s.start + 5,
    mediaUrl: `https://www.youtube-nocookie.com/embed/${s.ytId}?start=${s.start}&end=${s.start + 5}&autoplay=1`,
    targetCount: 1,
    status: "active",
    createdAt: "2026-10-10T00:00:00Z"
}));

const g05Secrets = g05Questions.map((q, i) => ({
    id: q.id,
    gameId: "G05",
    answerKey: g05Songs[i].anime,
    songTitle: g05Songs[i].song,
    youtubeId: g05Songs[i].ytId,
    startSeconds: g05Songs[i].start,
    endSeconds: g05Songs[i].start + 5
}));

// =========================================================================
// G06: Character Alphabet Rush (10 Letters)
// =========================================================================
const g06Letters = [
    { letter: 'A', chars: ["Anya Forger", "Armin Arlert", "Asta", "Asuka Langley", "All Might", "Akame", "Aoi Todo", "Aki Hayakawa"] },
    { letter: 'B', chars: ["Bakugo Katsuki", "Boruto Uzumaki", "Byakuya Kuchiki", "Baki Hanma", "Brook", "Bulma", "Beerus", "Ban (7 Deadly Sins)"] },
    { letter: 'D', chars: ["Denji", "Dio Brando", "Dazai Osamu", "Deku (Izuku)", "Doraemon", "Dracule Mihawk", "Diavolo"] },
    { letter: 'H', chars: ["Hinata Hyuga", "Himmel", "Hange Zoe", "Hisoka Morow", "Hiei", "Hawks", "Hachiman Hikigaya"] },
    { letter: 'K', chars: ["Kakashi Hatake", "Killua Zoldyck", "Kenshin Himura", "Kurapika", "Kirito", "Katsuki Bakugo", "Kento Nanami"] },
    { letter: 'M', chars: ["Monkey D. Luffy", "Megumi Fushiguro", "Mikasa Ackerman", "Muzan Kibutsuji", "Minato Namikaze", "Maki Zenin"] },
    { letter: 'N', chars: ["Naruto Uzumaki", "Nami", "Nezuko Kamado", "Nobara Kugisaki", "Near", "Nanami Kento", "Nagato"] },
    { letter: 'R', chars: ["Roronoa Zoro", "Ryomen Sukuna", "Rengoku Kyojuro", "Roy Mustang", "Rukia Kuchiki", "Rem", "Reiner Braun"] },
    { letter: 'S', chars: ["Satoru Gojo", "Saitama", "Sasuke Uchiha", "Sanji", "Shoto Todoroki", "Senku Ishigami", "Shanks", "Suguru Geto"] },
    { letter: 'T', chars: ["Tanjiro Kamado", "Todoroki Shoto", "Trafalgar Law", "Toshiro Hitsugaya", "Tobio Kageyama", "Tomura Shigaraki"] }
];

const g06Questions = g06Letters.map((l, i) => ({
    id: `Q-G06-${String(i + 1).padStart(3, '0')}`,
    gameId: "G06",
    gameTitle: "Character Alphabet Rush",
    displayPrompt: `Sebutkan 5 karakter anime yang diawali dengan huruf: ${l.letter}!`,
    letter: l.letter,
    targetCount: 5,
    status: "active",
    createdAt: "2026-10-10T00:00:00Z"
}));

const g06Secrets = g06Questions.map((q, i) => ({
    id: q.id,
    gameId: "G06",
    letter: q.letter,
    referenceAnswers: g06Letters[i].chars
}));

// =========================================================================
// G07: Three-Hint Character (10 Questions - Host Reads Hints to Participant)
// =========================================================================
const g07Characters = [
    {
        name: "Satoru Gojo",
        anime: "Jujutsu Kaisen",
        hints: [
            "Guru di SMA Jujutsu Tokyo yang berambut putih tegak",
            "Selalu memakai penutup mata hitam atau kacamata hitam",
            "Pengguna teknik kutukan Tak Terbatas (Mugen) dan Domain Muryokusho"
        ]
    },
    {
        name: "Monkey D. Luffy",
        anime: "One Piece",
        hints: [
            "Kapten bajak laut yang selalu memakai topi jerami",
            "Tubuhnya memiliki elastisitas karet dan bercita-cita jadi Raja Bajak Laut",
            "Memiliki bekas luka berbentuk silang (X) besar di dadanya"
        ]
    },
    {
        name: "Tanjiro Kamado",
        anime: "Demon Slayer (Kimetsu no Yaiba)",
        hints: [
            "Pembasmi iblis yang memakai anting hanafuda peninggalan ayahnya",
            "Membawa kotak kayu di punggungnya yang berisi adik perempuannya",
            "Memiliki bekas luka bakar di dahi kiri dan menguasai Pernapasan Matahari"
        ]
    },
    {
        name: "Levi Ackerman",
        anime: "Attack on Titan",
        hints: [
            "Prajurit terkuat umat manusia dari Pasukan Pengintai (Survey Corps)",
            "Sangat terobsesi dengan kebersihan (clean freak) dan bertubuh pendek",
            "Memegang pedang dengan gaya putaran terbalik yang mematikan saat membantai Titan"
        ]
    },
    {
        name: "Anya Forger",
        anime: "Spy x Family",
        hints: [
            "Anak angkat dari seorang mata-mata dan pembunuh bayaran",
            "Memiliki kekuatan esper rahasia yaitu dapat membaca pikiran orang lain",
            "Sangat menyukai kacang tanah dan punya ekspresi senyum 'Heh' yang ikonik"
        ]
    },
    {
        name: "Frieren",
        anime: "Sousou no Frieren",
        hints: [
            "Penyihir ras elf berambut kepang dua perak yang berumur ribuan tahun",
            "Mantan anggota kelompok pahlawan Himmel yang mengalahkan Raja Iblis",
            "Kerap kali tertipu dan terjebak di dalam peti harta karun Mimic"
        ]
    },
    {
        name: "Conan Edogawa (Shinichi Kudo)",
        anime: "Detective Conan",
        hints: [
            "Detektif SMA jenius yang tubuhnya menyusut menjadi anak SD akibat racun APTX 4869",
            "Memakai kacamata pelacak dan dasi kupu-kupu pengubah suara buatan Profesor Agasa",
            "Sering membius detektif Kogoro Mouri dengan jarum jam tangannya untuk memecahkan kasus"
        ]
    },
    {
        name: "Roronoa Zoro",
        anime: "One Piece",
        hints: [
            "Pendekar pedang berambut hijau yang memakai gaya bertarung tiga pedang (Santoryu)",
            "Memiliki kebiasaan buruk sangat parah yaitu selalu tersesat di mana saja",
            "Bercita-cita menjadi pendekar pedang terkuat di dunia mengalahkan Dracule Mihawk"
        ]
    },
    {
        name: "Megumin",
        anime: "Konosuba",
        hints: [
            "Penyihir muda dari klan Iblis Crimson bergaya chuunibyou dengan penutup mata",
            "Hanya mempelajari dan mau menggunakan satu jenis sihir yaitu Sihir Ledakan (Explosion)",
            "Selalu langsung lemas kehabisan mana dan tidak bisa bergerak setelah menembakkan sihirnya"
        ]
    },
    {
        name: "Saitama",
        anime: "One Punch Man",
        hints: [
            "Pahlawan berkepala botak licin yang mengenakan setelan kuning dan jubah putih",
            "Dapat mengalahkan hampir semua monster raksasa hanya dengan satu pukulan santai",
            "Sangat stres dan panik jika sampai melewatkan hari diskon belanja di supermarket"
        ]
    }
];

const g07Questions = g07Characters.map((c, i) => ({
    id: `Q-G07-${String(i + 1).padStart(3, '0')}`,
    gameId: "G07",
    gameTitle: "Three-Hint Character",
    displayPrompt: "Dengarkan 3 petunjuk ciri khas dari panitia, lalu tebak siapa karakternya!",
    hintsCount: 3,
    hints: c.hints,
    targetCount: 1,
    status: "active",
    createdAt: "2026-10-10T00:00:00Z"
}));

const g07Secrets = g07Questions.map((q, i) => ({
    id: q.id,
    gameId: "G07",
    characterName: g07Characters[i].name,
    animeOrigin: g07Characters[i].anime,
    answerKey: g07Characters[i].name,
    hints: g07Characters[i].hints
}));

// =========================================================================
// G08: Act Like That Character! (30 Questions - Real Poses & Iconic Characters)
// =========================================================================
const g08Poses = [
    { file: "pose_01.jpg", name: "Aki Hayakawa (Chainsaw Man)", phrase: "Pose Tangan Serigala 'Kon!'" },
    { file: "pose_02.jpg", name: "Killer Queen (JoJo's Bizarre Adventure)", phrase: "Pose Stand Siap Meledakkan Bom" },
    { file: "pose_03.jpg", name: "Yuji Itadori (Jujutsu Kaisen)", phrase: "Kuda-Kuda Bertarung Angkat Lutut & Tinju" },
    { file: "pose_04.jpg", name: "Jotaro Kujo (JoJo Part 3)", phrase: "Pose Menunjuk Kedepan 'Yare Yare Daze'" },
    { file: "pose_05.jpg", name: "Satoru Gojo (Jujutsu Kaisen)", phrase: "Pose Silang Jari Domain Expansion 'Muryokusho'" },
    { file: "pose_06.jpg", name: "Himmel the Hero (Frieren)", phrase: "Pose Narsis Tiup Ciuman Pahlawan Himmel" },
    { file: "pose_07.jpg", name: "Sailor Moon", phrase: "Pose Jari L 'Dengan kekuatan bulan aku akan menghukummu!'" },
    { file: "pose_08.jpg", name: "Ryomen Sukuna (Jujutsu Kaisen)", phrase: "Pose Tangan Domain 'Fukuma Mizushi'" },
    { file: "pose_09.jpg", name: "Dio Brando (JoJo Part 3)", phrase: "Pose Mendongak 'WRYYYYY!'" },
    { file: "pose_10.jpg", name: "Megumi Fushiguro (Jujutsu Kaisen)", phrase: "Pose Bayangan Tangan Memanggil Anjing Ilahi" },
    { file: "pose_11.jpg", name: "Aoi Todo (Jujutsu Kaisen)", phrase: "Pose Tepuk Tangan 'Boogie Woogie'" },
    { file: "pose_12.jpg", name: "Son Goku (Dragon Ball)", phrase: "Kuda-Kuda Kedua Tangan di Pinggang 'Kamehameha!'" },
    { file: "pose_13.jpg", name: "Naruto Uzumaki", phrase: "Pose Silang Dua Jari Telunjuk 'Kage Bunshin no Jutsu!'" },
    { file: "pose_14.jpg", name: "Levi Ackerman (Attack on Titan)", phrase: "Hormat Militer Tangan di Dada 'Shinzou wo Sasageyo!'" },
    { file: "pose_15.jpg", name: "Anya Forger (Spy x Family)", phrase: "Pose Senyum 'Heh' / Waku-Waku" },
    { file: "pose_16.jpg", name: "Monkey D. Luffy (One Piece)", phrase: "Pose Tinju Menekan Tanah 'Gear Second!'" },
    { file: "pose_17.jpg", name: "Roronoa Zoro (One Piece)", phrase: "Kuda-Kuda Santoryu (Satu Pedang di Mulut Dua di Tangan)" },
    { file: "pose_18.jpg", name: "Ken Kaneki (Tokyo Ghoul)", phrase: "Pose Menekuk Sendi Jari Telunjuk dengan Jempol" },
    { file: "pose_19.jpg", name: "L Lawliet (Death Note)", phrase: "Pose Duduk Jongkok Menggigit Jempol" },
    { file: "pose_20.jpg", name: "Edward Elric (Fullmetal Alchemist)", phrase: "Pose Menepuk Kedua Telapak Tangan Bersatu (Transmutasi)" },
    { file: "pose_21.jpg", name: "Eren Yeager (Attack on Titan)", phrase: "Pose Menggigit Pangkal Ibu Jari Tangan" },
    { file: "pose_22.jpg", name: "Jonathan Joestar (JoJo Part 1)", phrase: "Pose Tangan Menutupi Separuh Wajah" },
    { file: "pose_23.jpg", name: "Kento Nanami (Jujutsu Kaisen)", phrase: "Pose Melilitkan Dasi ke Kepalan Tangan" },
    { file: "pose_24.jpg", name: "Josuke Higashikata (JoJo Part 4)", phrase: "Pose Membanggakan Gaya Rambut Pompadour" },
    { file: "pose_25.jpg", name: "Suguru Geto (Jujutsu Kaisen)", phrase: "Pose Menengadahkan Tangan Memanggil Kutukan 'Uzumaki'" },
    { file: "pose_26.jpg", name: "Fern (Frieren)", phrase: "Pose Menggembungkan Pipi Ngambek / Menembak 'Zoltraak'" },
    { file: "pose_27.jpg", name: "Denji (Chainsaw Man)", phrase: "Pose Menarik Tali Starter Chainsaw di Dada" },
    { file: "pose_28.jpg", name: "Joseph Joestar (JoJo Part 2)", phrase: "Pose Lari Terbirit-birit 'Nigerundayo!'" },
    { file: "pose_29.jpg", name: "Tobio Kageyama & Hinata (Haikyuu)", phrase: "Pose Kuda-kuda Siap Toss & Smash Cepat" },
    { file: "pose_30.jpg", name: "All Might (My Hero Academia)", phrase: "Pose Mengacungkan Jempol Dada Membusung 'Watashi ga Kita!'" }
];

const g08Questions = g08Poses.map((p, i) => ({
    id: `Q-G08-${String(i + 1).padStart(3, '0')}`,
    gameId: "G08",
    gameTitle: "Act Like That Character!",
    displayPrompt: "Tirukan pose karakter anime berikut ini dengan jelas!",
    characterName: p.name,
    phrasePrompt: p.phrase,
    mediaUrl: `/arcade/poses/${p.file}`,
    targetCount: 1,
    status: "active",
    createdAt: "2026-10-10T00:00:00Z"
}));

const g08Secrets = g08Questions.map((q, i) => ({
    id: q.id,
    gameId: "G08",
    targetCharacter: g08Poses[i].name,
    idealCatchphrase: g08Poses[i].phrase,
    scoringCriteria: "Demonstrasi pose ikonik tertirukan dengan jelas."
}));

// =========================================================================
// G09: Find the Impostor: Character Edition (10 Questions)
// =========================================================================
const g09Sets = [
    {
        options: ["Monkey D. Luffy", "Roronoa Zoro", "Naruto Uzumaki", "Vinsmoke Sanji", "Nami"],
        impostorIdx: 2,
        impostorChar: "Naruto Uzumaki",
        impostorFranchise: "Naruto",
        commonFranchise: "One Piece",
        explanation: "Naruto berasal dari anime Naruto, 4 karakter lainnya adalah kru Bajak Laut Topi Jerami dari One Piece."
    },
    {
        options: ["Tanjiro Kamado", "Nezuko Kamado", "Zenitsu Agatsuma", "Megumi Fushiguro", "Inosuke Hashibira"],
        impostorIdx: 3,
        impostorChar: "Megumi Fushiguro",
        impostorFranchise: "Jujutsu Kaisen",
        commonFranchise: "Demon Slayer (Kimetsu no Yaiba)",
        explanation: "Megumi berasal dari Jujutsu Kaisen, 4 lainnya dari Demon Slayer."
    },
    {
        options: ["Gon Freecss", "Killua Zoldyck", "Kurapika", "Sasuke Uchiha", "Leorio Paradinight"],
        impostorIdx: 3,
        impostorChar: "Sasuke Uchiha",
        impostorFranchise: "Naruto",
        commonFranchise: "Hunter x Hunter",
        explanation: "Sasuke dari Naruto, 4 lainnya dari Hunter x Hunter."
    },
    {
        options: ["Satoru Gojo", "Yuji Itadori", "Nobara Kugisaki", "Denji", "Kento Nanami"],
        impostorIdx: 3,
        impostorChar: "Denji",
        impostorFranchise: "Chainsaw Man",
        commonFranchise: "Jujutsu Kaisen",
        explanation: "Denji dari Chainsaw Man, 4 lainnya penyihir dari Jujutsu Kaisen."
    },
    {
        options: ["Eren Yeager", "Mikasa Ackerman", "Armin Arlert", "Levi Ackerman", "Guts"],
        impostorIdx: 4,
        impostorChar: "Guts",
        impostorFranchise: "Berserk",
        commonFranchise: "Attack on Titan",
        explanation: "Guts dari Berserk, 4 lainnya adalah prajurit Pasukan Pengintai dari Attack on Titan."
    },
    {
        options: ["Izuku Midoriya", "Katsuki Bakugo", "Shoto Todoroki", "Edward Elric", "Ochaco Uraraka"],
        impostorIdx: 3,
        impostorChar: "Edward Elric",
        impostorFranchise: "Fullmetal Alchemist",
        commonFranchise: "My Hero Academia",
        explanation: "Edward Elric dari Fullmetal Alchemist, 4 lainnya murid Kelas 1-A dari My Hero Academia."
    },
    {
        options: ["Ichigo Kurosaki", "Rukia Kuchiki", "Byakuya Kuchiki", "Roronoa Zoro", "Toshiro Hitsugaya"],
        impostorIdx: 3,
        impostorChar: "Roronoa Zoro",
        impostorFranchise: "One Piece",
        commonFranchise: "Bleach",
        explanation: "Zoro dari One Piece, 4 lainnya adalah Shinigami dari Bleach."
    },
    {
        options: ["Shoyo Hinata", "Tobio Kageyama", "Kei Tsukishima", "Yu Nishinoya", "Ryota Kise"],
        impostorIdx: 4,
        impostorChar: "Ryota Kise",
        impostorFranchise: "Kuroko no Basket",
        commonFranchise: "Haikyuu!!",
        explanation: "Ryota Kise pemain basket dari Kuroko no Basket, 4 lainnya pemain voli SMA Karasuno dari Haikyuu!!."
    },
    {
        options: ["Hitori Gotoh", "Nijika Ijichi", "Ryo Yamada", "Ikuyo Kita", "Yui Hirasawa"],
        impostorIdx: 4,
        impostorChar: "Yui Hirasawa",
        impostorFranchise: "K-On!",
        commonFranchise: "Bocchi the Rock!",
        explanation: "Yui Hirasawa dari klub Houkago Tea Time K-On!, 4 lainnya anggota Kessoku Band dari Bocchi the Rock!."
    },
    {
        options: ["Denji", "Power", "Aki Hayakawa", "Makima", "Aoi Todo"],
        impostorIdx: 4,
        impostorChar: "Aoi Todo",
        impostorFranchise: "Jujutsu Kaisen",
        commonFranchise: "Chainsaw Man",
        explanation: "Aoi Todo dari Jujutsu Kaisen, 4 lainnya pemburu iblis Public Safety dari Chainsaw Man."
    }
];

const g09Questions = g09Sets.map((s, i) => ({
    id: `Q-G09-${String(i + 1).padStart(3, '0')}`,
    gameId: "G09",
    gameTitle: "Find the Impostor: Character Edition",
    displayPrompt: "Cari 1 karakter yang berasal dari anime/franchise berbeda di antara 5 opsi berikut!",
    options: s.options,
    targetCount: 1,
    status: "active",
    createdAt: "2026-10-10T00:00:00Z"
}));

const g09Secrets = g09Questions.map((q, i) => ({
    id: q.id,
    gameId: "G09",
    impostorIndex: g09Sets[i].impostorIdx,
    impostorCharacter: g09Sets[i].impostorChar,
    impostorFranchise: g09Sets[i].impostorFranchise,
    commonFranchise: g09Sets[i].commonFranchise,
    explanation: g09Sets[i].explanation
}));

// =========================================================================
// G10: Find the Impostor: Anime Edition (10 Questions - 4 Real Anime + 1 Fictitious Title)
// =========================================================================
const g10Sets = [
    {
        options: [
            "Shinsekai Yori",
            "Shiki",
            "Higurashi no Naku Koro ni",
            "Yami no Chinkon-ka: Kuroi Requiem",
            "Another"
        ],
        impostorIdx: 3,
        fakeTitle: "Yami no Chinkon-ka: Kuroi Requiem",
        explanation: "Yami no Chinkon-ka: Kuroi Requiem adalah judul fiktif. 4 judul lainnya adalah anime misteri/horor psikologis nyata."
    },
    {
        options: [
            "Seishun Buta Yarou wa Bunny Girl Senpai no Yume wo Minai",
            "Boku wa Tomodachi ga Sukunai",
            "Ore no Imouto ga Konna ni Kawaii Wake ga Nai",
            "Tonari no Seito Kaichou ga Yandere Sugiru Ken",
            "Saenai Heroine no Sodatekata"
        ],
        impostorIdx: 3,
        fakeTitle: "Tonari no Seito Kaichou ga Yandere Sugiru Ken",
        explanation: "Tonari no Seito Kaichou ga Yandere Sugiru Ken adalah judul karangan fiktif bergaya light novel. 4 lainnya adalah anime adaptasi light novel rom-com nyata."
    },
    {
        options: [
            "Mushishi",
            "Natsume Yuujinchou",
            "Kino no Tabi: The Beautiful World",
            "Mononoke",
            "Gensou Yakushi no Tabiki: Kioku no Mori"
        ],
        impostorIdx: 4,
        fakeTitle: "Gensou Yakushi no Tabiki: Kioku no Mori",
        explanation: "Gensou Yakushi no Tabiki: Kioku no Mori adalah anime fiktif. 4 lainnya adalah anime petualangan supranatural / iyashikei nyata."
    },
    {
        options: [
            "Baccano!",
            "Durarara!!",
            "Gangsta.",
            "91 Days",
            "Cosa Nostra Syndicate: Requiem 1930"
        ],
        impostorIdx: 4,
        fakeTitle: "Cosa Nostra Syndicate: Requiem 1930",
        explanation: "Cosa Nostra Syndicate: Requiem 1930 adalah karangan fiktif. 4 lainnya adalah anime kriminal/mafia terkenal."
    },
    {
        options: [
            "Psycho-Pass",
            "Ergo Proxy",
            "Texhnolyze",
            "Neuro-Dystopia: Code Babel",
            "Serial Experiments Lain"
        ],
        impostorIdx: 3,
        fakeTitle: "Neuro-Dystopia: Code Babel",
        explanation: "Neuro-Dystopia: Code Babel adalah fiktif. 4 lainnya adalah anime cyberpunk/sci-fi klasik nyata."
    },
    {
        options: [
            "Odd Taxi",
            "Kaiba",
            "Kemonozume",
            "Yoru no Doubutsu Kaigi: Midnight Metro",
            "The Tatami Galaxy"
        ],
        impostorIdx: 3,
        fakeTitle: "Yoru no Doubutsu Kaigi: Midnight Metro",
        explanation: "Yoru no Doubutsu Kaigi: Midnight Metro adalah anime fiktif. 4 lainnya adalah karya animasi avant-garde/indie nyata."
    },
    {
        options: [
            "Chihayafuru",
            "3-gatsu no Lion",
            "Shouwa Genroku Rakugo Shinjuu",
            "Koto no Ne: Hibike Karuta Densetsu",
            "Hikaru no Go"
        ],
        impostorIdx: 3,
        fakeTitle: "Koto no Ne: Hibike Karuta Densetsu",
        explanation: "Koto no Ne: Hibike Karuta Densetsu adalah anime fiktif. 4 lainnya adalah anime seni tradisional & permainan strategi Jepang nyata."
    },
    {
        options: [
            "Planetes",
            "Space Brothers (Uchuu Kyoudai)",
            "Kanata no Astra",
            "Cosmo Orbit: Project Starlight",
            "Moonlight Mile"
        ],
        impostorIdx: 3,
        fakeTitle: "Cosmo Orbit: Project Starlight",
        explanation: "Cosmo Orbit: Project Starlight adalah anime fiktif. 4 lainnya adalah anime luar angkasa hard sci-fi nyata."
    },
    {
        options: [
            "Land of the Lustrous (Houseki no Kuni)",
            "Made in Abyss",
            "Shinsekai Yori",
            "Kiseki no Crystal: Chitei no Shingetsu",
            "Dorohedoro"
        ],
        impostorIdx: 3,
        fakeTitle: "Kiseki no Crystal: Chitei no Shingetsu",
        explanation: "Kiseki no Crystal: Chitei no Shingetsu adalah anime fiktif. 4 lainnya adalah anime dark fantasy dunia unik nyata."
    },
    {
        options: [
            "Gankutsuou: The Count of Monte Cristo",
            "Katanagatari",
            "Mawaru Penguindrum",
            "Kyoto Paradox: Meikyuu no Rokugatsu",
            "FLCL (Fooly Cooly)"
        ],
        impostorIdx: 3,
        fakeTitle: "Kyoto Paradox: Meikyuu no Rokugatsu",
        explanation: "Kyoto Paradox: Meikyuu no Rokugatsu adalah judul fiktif. 4 lainnya adalah anime kultus bergaya visual unik nyata."
    }
];

const g10Questions = g10Sets.map((s, i) => ({
    id: `Q-G10-${String(i + 1).padStart(3, '0')}`,
    gameId: "G10",
    gameTitle: "Find the Impostor: Anime Edition",
    displayPrompt: "Cari 1 judul anime fiktif (palsu) di antara 5 judul berikut!",
    options: s.options,
    targetCount: 1,
    status: "active",
    createdAt: "2026-10-10T00:00:00Z"
}));

const g10Secrets = g10Questions.map((q, i) => ({
    id: q.id,
    gameId: "G10",
    impostorIndex: g10Sets[i].impostorIdx,
    fictitiousTitle: g10Sets[i].fakeTitle,
    explanation: g10Sets[i].explanation
}));

// Combine all questions and secrets
const allQuestions = [
    ...g01Questions,
    ...g02Questions,
    ...g03Questions,
    ...g04Questions,
    ...g05Questions,
    ...g06Questions,
    ...g07Questions,
    ...g08Questions,
    ...g09Questions,
    ...g10Questions
];

const allSecrets = [
    ...g01Secrets,
    ...g02Secrets,
    ...g03Secrets,
    ...g04Secrets,
    ...g05Secrets,
    ...g06Secrets,
    ...g07Secrets,
    ...g08Secrets,
    ...g09Secrets,
    ...g10Secrets
];

const fileContent = `// Kanvahati Arcade — Comprehensive Anime Dataset
export const TEST_AUDIO_DATA_URI = "data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRAAAAAAAAAAAAAAAAAAAAAAAAAA";

export const INITIAL_QUESTIONS = ${JSON.stringify(allQuestions, null, 4)};

export const INITIAL_SECRETS = ${JSON.stringify(allSecrets, null, 4)};
`;

fs.writeFileSync('src/arcade/data/initialQuestionBank.js', fileContent);
console.log(`Generated ${allQuestions.length} questions and ${allSecrets.length} secrets.`);
