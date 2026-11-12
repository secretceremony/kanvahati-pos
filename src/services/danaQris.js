// --- DANA SNAP QRIS Acquirer Service & Client Bridge ---
// Implements the request/response contract for DANA API v2:
//   POST /v1.0/qr/qr-mpm-generate.htm (SNAP Service Code 47)
//   POST /rest/v1.1/debit/status (SNAP Service Code 55)
// Because SNAP asymmetric signatures (SHA256withRSA) require a confidential RSA-2048 Private Key,
// production calls route through a configured server proxy / Firebase Cloud Function URL.
// When no SNAP backend proxy is configured, the POS seamlessly uses Client EMVCo Dynamic QRIS
// generated from the merchant's verified DANA QRIS payload.

import { buildDynamicQris, DEFAULT_STATIC_QRIS_PAYLOAD, extractQrisInfo } from '../utils/qris.js';

/**
 * Format Date as Jakarta ISO-8601 timestamp (YYYY-MM-DDTHH:mm:ss+07:00) per DANA SNAP spec.
 */
export function formatJakartaTimestamp(date = new Date()) {
    const utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
    const wib = new Date(utcMs + 7 * 3600 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    return (
        `${wib.getFullYear()}-${pad(wib.getMonth() + 1)}-${pad(wib.getDate())}` +
        `T${pad(wib.getHours())}:${pad(wib.getMinutes())}:${pad(wib.getSeconds())}+07:00`
    );
}

/**
 * Generate a DANA-compliant partnerReferenceNo (max 25 chars for QRIS scenario).
 */
export function createPartnerReferenceNo(prefix = 'KH') {
    const now = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `${prefix}${now}${rand}`.slice(0, 25);
}

/**
 * Build exact DANA SNAP `/v1.0/qr/qr-mpm-generate.htm` request payload.
 */
export function buildDanaGenerateQrisPayload({
    merchantId,
    storeId,
    subMerchantId = '',
    terminalId = '',
    partnerReferenceNo,
    amountIdr,
    validitySeconds = 900,
    terminalSource = 'MER'
}) {
    const numAmount = Math.max(1, Math.round(Number(amountIdr) || 0));
    const expiresAt = new Date(Date.now() + validitySeconds * 1000);

    const body = {
        merchantId: String(merchantId || ''),
        storeId: String(storeId || ''),
        partnerReferenceNo: String(partnerReferenceNo || createPartnerReferenceNo()),
        amount: {
            value: `${numAmount}.00`,
            currency: 'IDR'
        },
        validityPeriod: formatJakartaTimestamp(expiresAt),
        additionalInfo: {
            terminalSource,
            envInfo: {
                sourcePlatform: 'IPG',
                terminalType: 'WEB',
                orderTerminalType: 'WEB'
            }
        }
    };

    if (subMerchantId) body.subMerchantId = String(subMerchantId);
    if (terminalId) body.terminalId = String(terminalId);
    return body;
}

/**
 * Build exact DANA SNAP `/rest/v1.1/debit/status` query payload for MPM QRIS (serviceCode 47).
 */
export function buildDanaQueryPaymentPayload({
    merchantId,
    storeId = '',
    originalPartnerReferenceNo,
    originalReferenceNo = '',
    amountIdr
}) {
    const numAmount = Math.max(1, Math.round(Number(amountIdr) || 0));
    return {
        originalPartnerReferenceNo: String(originalPartnerReferenceNo || ''),
        originalReferenceNo: String(originalReferenceNo || ''),
        serviceCode: '47',
        amount: {
            value: `${numAmount}.00`,
            currency: 'IDR'
        },
        merchantId: String(merchantId || ''),
        externalStoreId: String(storeId || ''),
        additionalInfo: {}
    };
}

/**
 * Resolve dynamic QRIS content for checkout.
 * - If `config.mode === 'dana_snap'` and `config.danaProxyUrl` is set, calls the SNAP proxy endpoint
 *   (`POST ${danaProxyUrl}/qr/generate`) and falls back to EMVCo dynamic QRIS on offline/network error.
 * - Otherwise builds a standard EMVCo Dynamic QRIS string from `config.staticPayload` (or default).
 */
export async function generateCheckoutDynamicQris({ amountIdr, config = {}, partnerReferenceNo }) {
    const refNo = partnerReferenceNo || createPartnerReferenceNo('KH');
    const staticPayload = config?.staticPayload || DEFAULT_STATIC_QRIS_PAYLOAD;
    const merchantInfo = extractQrisInfo(staticPayload);

    if (config?.mode === 'dana_snap' && config?.danaProxyUrl) {
        const proxyBase = config.danaProxyUrl.replace(/\/+$/, '');
        const snapPayload = buildDanaGenerateQrisPayload({
            merchantId: config.merchantId,
            storeId: config.storeId,
            subMerchantId: config.subMerchantId,
            terminalId: config.terminalId,
            partnerReferenceNo: refNo,
            amountIdr
        });

        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 8000); // DANA spec expected timeout: 8s
            const res = await fetch(`${proxyBase}/qr/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(snapPayload),
                signal: controller.signal
            });
            clearTimeout(timer);

            const data = await res.json();
            if (res.ok && data?.responseCode === '2004700' && data?.qrContent) {
                return {
                    source: 'dana_snap',
                    qrContent: data.qrContent,
                    partnerReferenceNo: data.partnerReferenceNo || refNo,
                    referenceNo: data.referenceNo || '',
                    merchantName: data.merchantName || merchantInfo.merchantName,
                    merchantCity: merchantInfo.merchantCity,
                    nmid: merchantInfo.nmid,
                    validityPeriod: snapPayload.validityPeriod,
                    fallbackUsed: false
                };
            }
            console.warn('DANA SNAP proxy returned non-2004700, falling back to EMVCo dynamic QRIS:', data);
        } catch (err) {
            console.warn('DANA SNAP proxy unreachable, falling back to EMVCo dynamic QRIS:', err);
        }
    }

    const qrContent = buildDynamicQris(staticPayload, amountIdr, refNo);
    return {
        source: 'emv_dynamic',
        qrContent,
        partnerReferenceNo: refNo,
        referenceNo: '',
        merchantName: config?.merchantName || merchantInfo.merchantName,
        merchantCity: merchantInfo.merchantCity,
        nmid: merchantInfo.nmid,
        validityPeriod: null,
        fallbackUsed: config?.mode === 'dana_snap'
    };
}

/**
 * Query DANA SNAP payment status via configured backend proxy (`POST ${danaProxyUrl}/qr/status`).
 * Returns { status: 'PAID' | 'PENDING' | 'CANCELLED' | 'NOT_FOUND' | 'UNAVAILABLE', raw }.
 */
export async function queryDanaPaymentStatus({ config, partnerReferenceNo, referenceNo = '', amountIdr }) {
    if (!config?.danaProxyUrl) {
        return { status: 'UNAVAILABLE', raw: null };
    }
    const proxyBase = config.danaProxyUrl.replace(/\/+$/, '');
    const payload = buildDanaQueryPaymentPayload({
        merchantId: config.merchantId,
        storeId: config.storeId,
        originalPartnerReferenceNo: partnerReferenceNo,
        originalReferenceNo: referenceNo,
        amountIdr
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
        const res = await fetch(`${proxyBase}/qr/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        const data = await res.json();
        if (data?.responseCode === '2005500') {
            const txStatus = data.latestTransactionStatus;
            if (txStatus === '00' || txStatus === '02') return { status: 'PAID', raw: data };
            if (txStatus === '01') return { status: 'PENDING', raw: data };
            if (txStatus === '05') return { status: 'CANCELLED', raw: data };
            if (txStatus === '07') return { status: 'NOT_FOUND', raw: data };
        }
        return { status: 'PENDING', raw: data };
    } finally {
        clearTimeout(timer);
    }
}
