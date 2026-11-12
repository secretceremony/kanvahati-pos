// --- EMVCo QRIS TLV Parser & Dynamic QRIS Generator (Static-to-Dynamic + DANA Metadata) ---

// Default static QRIS payload decoded from public/qris.png (Merchant: silvxeri, Acquirer: ID.DANA.WWW)
export const DEFAULT_STATIC_QRIS_PAYLOAD =
    '00020101021126570011ID.DANA.WWW011893600915391066374302099106637430303UMI51440014ID.CO.QRIS.WWW0215ID10254046040640303UMI5204729853033605802ID5908silvxeri6015Kota Balikpapan61057612963046FB8';

/**
 * Compute CRC16-CCITT (init 0xFFFF, poly 0x1021) uppercase 4-hex string.
 * Spec: EMVCo Merchant-Presented QR Code Specification (Tag 63).
 */
export function computeCrc16Ccitt(input) {
    let crc = 0xFFFF;
    const bytes = new TextEncoder().encode(input);
    for (let i = 0; i < bytes.length; i++) {
        crc ^= bytes[i] << 8;
        for (let bit = 0; bit < 8; bit++) {
            if ((crc & 0x8000) !== 0) {
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
            } else {
                crc = (crc << 1) & 0xFFFF;
            }
        }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Parse a flat EMVCo TLV string into ordered [{ tag, value }] entries.
 */
export function parseEmvTlv(payload) {
    if (!payload || typeof payload !== 'string') {
        throw new Error('QRIS payload is empty');
    }
    const clean = payload.trim();
    const entries = [];
    let i = 0;
    while (i < clean.length) {
        if (i + 4 > clean.length) {
            throw new Error(`Invalid TLV header at offset ${i}`);
        }
        const tag = clean.slice(i, i + 2);
        const lenStr = clean.slice(i + 2, i + 4);
        if (!/^\d{2}$/.test(lenStr)) {
            throw new Error(`Invalid TLV length "${lenStr}" for tag ${tag}`);
        }
        const len = parseInt(lenStr, 10);
        const start = i + 4;
        const end = start + len;
        if (end > clean.length) {
            throw new Error(`TLV value truncated for tag ${tag}`);
        }
        entries.push({ tag, value: clean.slice(start, end) });
        i = end;
    }
    return entries;
}

/**
 * Serialize [{ tag, value }] TLV entries into an EMVCo payload string.
 */
export function serializeEmvTlv(entries) {
    return entries
        .map(({ tag, value }) => {
            const valStr = String(value);
            const byteLen = new TextEncoder().encode(valStr).length;
            if (byteLen > 99) {
                throw new Error(`TLV value too long (${byteLen} bytes) for tag ${tag}`);
            }
            return `${tag}${String(byteLen).padStart(2, '0')}${valStr}`;
        })
        .join('');
}

/**
 * Validate EMVCo QRIS payload structure and CRC16 checksum.
 */
export function validateQrisPayload(payload) {
    try {
        const clean = String(payload || '').trim();
        if (clean.length < 20) {
            return { valid: false, reason: 'Payload terlalu pendek' };
        }
        const entries = parseEmvTlv(clean);
        const map = new Map(entries.map((e) => [e.tag, e.value]));
        if (map.get('00') !== '01') {
            return { valid: false, reason: 'Payload Format Indicator (Tag 00) bukan 01' };
        }
        const crc = map.get('63');
        if (!crc || crc.length !== 4 || !clean.endsWith(`6304${crc}`)) {
            return { valid: false, reason: 'Tag 63 CRC tidak ditemukan di akhir payload' };
        }
        const expected = computeCrc16Ccitt(clean.slice(0, -4));
        if (expected !== crc.toUpperCase()) {
            return { valid: false, reason: `CRC tidak cocok (terbaca ${crc}, seharusnya ${expected})` };
        }
        const hasMerchantAccount = entries.some((e) => Number(e.tag) >= 26 && Number(e.tag) <= 51);
        if (!hasMerchantAccount) {
            return { valid: false, reason: 'Merchant Account Information (Tag 26-51) tidak ada' };
        }
        return {
            valid: true,
            info: extractQrisInfo(clean)
        };
    } catch (err) {
        return { valid: false, reason: err.message };
    }
}

/**
 * Extract readable merchant & acquirer metadata from a QRIS payload.
 */
export function extractQrisInfo(payload) {
    const entries = parseEmvTlv(payload);
    const map = new Map(entries.map((e) => [e.tag, e.value]));

    let acquirerDomain = '';
    let nmid = '';
    for (const { tag, value } of entries) {
        const num = Number(tag);
        if (num >= 26 && num <= 51) {
            try {
                const sub = parseEmvTlv(value);
                const subMap = new Map(sub.map((s) => [s.tag, s.value]));
                if (tag === '26' && subMap.get('00')) {
                    acquirerDomain = subMap.get('00');
                }
                if (tag === '51' && subMap.get('02')) {
                    nmid = subMap.get('02');
                }
            } catch {
                // Ignore malformed optional subtag
            }
        }
    }

    return {
        pointOfInitiation: map.get('01') || '11',
        isDynamic: map.get('01') === '12',
        merchantName: map.get('59') || 'Merchant',
        merchantCity: map.get('60') || '',
        postalCode: map.get('61') || '',
        amount: map.get('54') ? Number(map.get('54')) : null,
        currency: map.get('53') || '360',
        acquirerDomain,
        nmid
    };
}

/**
 * Convert a static (or existing) EMVCo QRIS string into a dynamic QRIS string
 * with Tag 01 = "12" (dynamic), Tag 54 = exact integer IDR amount, optional Tag 62.01 reference,
 * and fresh Tag 63 CRC16-CCITT.
 */
export function buildDynamicQris(staticPayload, amountIdr, partnerReferenceNo = '') {
    const clean = String(staticPayload || DEFAULT_STATIC_QRIS_PAYLOAD).trim();
    const numericAmount = Math.round(Number(amountIdr) || 0);
    if (numericAmount <= 0) {
        throw new Error('Nominal transaksi QRIS harus lebih dari Rp 0');
    }

    const entries = parseEmvTlv(clean).filter((e) => e.tag !== '63');

    // Update or insert Tag 01 -> 12 (Dynamic QR)
    const setOrInsert = (list, tag, value) => {
        const idx = list.findIndex((e) => e.tag === tag);
        if (idx >= 0) {
            list[idx] = { tag, value };
        } else {
            list.push({ tag, value });
        }
    };

    setOrInsert(entries, '01', '12');
    setOrInsert(entries, '53', '360'); // IDR numeric ISO 4217
    setOrInsert(entries, '54', String(numericAmount));

    // Optionally attach reference in Tag 62 subtag 01 (Bill Number) or 05 (Reference Label)
    const cleanRef = String(partnerReferenceNo || '')
        .replace(/[^A-Za-z0-9\-_.]/g, '')
        .slice(0, 25);
    if (cleanRef) {
        const existing62 = entries.find((e) => e.tag === '62');
        let sub62 = [];
        if (existing62) {
            try {
                sub62 = parseEmvTlv(existing62.value).filter((s) => s.tag !== '05');
            } catch {
                sub62 = [];
            }
        }
        sub62.push({ tag: '05', value: cleanRef });
        sub62.sort((a, b) => Number(a.tag) - Number(b.tag));
        setOrInsert(entries, '62', serializeEmvTlv(sub62));
    }

    // Sort tags numerically per EMVCo convention (00..62)
    entries.sort((a, b) => Number(a.tag) - Number(b.tag));

    const bodyWithoutCrc = serializeEmvTlv(entries) + '6304';
    const crc = computeCrc16Ccitt(bodyWithoutCrc);
    return bodyWithoutCrc + crc;
}
