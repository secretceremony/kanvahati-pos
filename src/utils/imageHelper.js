// --- Client-Side Merch Image Compression & Validation Helper ---
// Converts uploaded product photos to sharp WebP so they load fast and fit cleanly
// inside Firestore documents without hurting visual resolution on POS cards.

const MAX_DIMENSION = 720;
const WEBP_QUALITIES = [0.86, 0.78, 0.68];
const FALLBACK_JPEG_QUALITIES = [0.82, 0.68];
const MAX_DATA_URL_CHARS = 180000; // ~135 KB binary equivalent (safe inside 1 MiB Firestore doc)

/**
 * Compress a File/Blob image into a crisp WebP Data URL on canvas.
 * Preserves alpha transparency for sticker/merch cutouts when WebP encoding is supported.
 */
export function compressImageFile(file, maxDim = MAX_DIMENSION) {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject(new Error('File gambar tidak ditemukan'));
            return;
        }
        if (!file.type.startsWith('image/')) {
            reject(new Error('File harus berupa gambar (PNG, JPG, WebP)'));
            return;
        }

        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
        reader.onload = (e) => {
            const img = new Image();
            img.onerror = () => reject(new Error('Gambar tidak valid atau rusak'));
            img.onload = () => {
                let { width, height } = img;
                if (width > maxDim || height > maxDim) {
                    if (width >= height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, width);
                canvas.height = Math.max(1, height);
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                for (const q of WEBP_QUALITIES) {
                    const candidate = canvas.toDataURL('image/webp', q);
                    if (candidate.startsWith('data:image/webp') && candidate.length <= MAX_DATA_URL_CHARS) {
                        resolve(candidate);
                        return;
                    }
                }

                // Fallback only if browser lacks WebP encode or image is ultra-dense
                ctx.globalCompositeOperation = 'destination-over';
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.globalCompositeOperation = 'source-over';

                let out = '';
                for (const q of FALLBACK_JPEG_QUALITIES) {
                    out = canvas.toDataURL('image/jpeg', q);
                    if (out.length <= MAX_DATA_URL_CHARS) break;
                }
                resolve(out);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

/**
 * Check if a product's img field is a real displayable image (Data URL or http(s)/root path)
 * vs legacy broken placeholder paths like 'assets/mascot.png' or 'assets/sticker_pack.png'.
 */
export function resolveProductImageUrl(img) {
    if (!img || typeof img !== 'string') return null;
    const trimmed = img.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('data:image/')) return trimmed;
    if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) return trimmed;
    if (trimmed.startsWith('/')) return trimmed;
    // Ignore legacy unserved relative 'assets/...' placeholder strings
    if (trimmed.startsWith('assets/')) return null;
    return trimmed;
}
