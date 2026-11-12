import test from 'node:test';
import assert from 'node:assert/strict';
import {
    DEFAULT_STATIC_QRIS_PAYLOAD,
    computeCrc16Ccitt,
    parseEmvTlv,
    validateQrisPayload,
    extractQrisInfo,
    buildDynamicQris
} from '../src/utils/qris.js';
import {
    formatJakartaTimestamp,
    buildDanaGenerateQrisPayload,
    buildDanaQueryPaymentPayload
} from '../src/services/danaQris.js';

test('Dynamic QRIS (EMVCo TLV & DANA SNAP Contract) Suite', async (t) => {
    await t.test('1. Default static QRIS payload from public/qris.png passes EMVCo CRC16 validation', () => {
        const res = validateQrisPayload(DEFAULT_STATIC_QRIS_PAYLOAD);
        assert.equal(res.valid, true);
        assert.equal(res.info.merchantName, 'silvxeri');
        assert.equal(res.info.acquirerDomain, 'ID.DANA.WWW');
        assert.equal(res.info.nmid, 'ID1025404604064');
        assert.equal(res.info.isDynamic, false);
    });

    await t.test('2. buildDynamicQris switches Tag 01=12, injects Tag 54 & Tag 62.05, and produces valid CRC16', () => {
        const dynamicQr = buildDynamicQris(DEFAULT_STATIC_QRIS_PAYLOAD, 45000, 'KH-REF-001');
        const check = validateQrisPayload(dynamicQr);
        assert.equal(check.valid, true, check.reason);
        assert.equal(check.info.isDynamic, true);
        assert.equal(check.info.amount, 45000);
        assert.equal(check.info.merchantName, 'silvxeri');

        const entries = parseEmvTlv(dynamicQr);
        const tagMap = new Map(entries.map((e) => [e.tag, e.value]));
        assert.equal(tagMap.get('01'), '12');
        assert.equal(tagMap.get('53'), '360');
        assert.equal(tagMap.get('54'), '45000');

        const sub62 = new Map(parseEmvTlv(tagMap.get('62')).map((e) => [e.tag, e.value]));
        assert.equal(sub62.get('05'), 'KH-REF-001');

        const expectedCrc = computeCrc16Ccitt(dynamicQr.slice(0, -4));
        assert.equal(dynamicQr.slice(-4), expectedCrc);
    });

    await t.test('3. buildDynamicQris rejects zero or negative amounts', () => {
        assert.throws(() => buildDynamicQris(DEFAULT_STATIC_QRIS_PAYLOAD, 0));
        assert.throws(() => buildDynamicQris(DEFAULT_STATIC_QRIS_PAYLOAD, -5000));
    });

    await t.test('4. DANA SNAP Generate QRIS payload matches /v1.0/qr/qr-mpm-generate.htm specification', () => {
        const ts = formatJakartaTimestamp(new Date('2026-11-12T00:00:00Z'));
        assert.match(ts, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+07:00$/);

        const body = buildDanaGenerateQrisPayload({
            merchantId: '23489182303312',
            storeId: 'KANVAHATI-BOOTH-1',
            partnerReferenceNo: 'KH123456',
            amountIdr: 125000
        });
        assert.equal(body.merchantId, '23489182303312');
        assert.equal(body.storeId, 'KANVAHATI-BOOTH-1');
        assert.equal(body.partnerReferenceNo, 'KH123456');
        assert.deepEqual(body.amount, { value: '125000.00', currency: 'IDR' });
        assert.equal(body.additionalInfo.envInfo.sourcePlatform, 'IPG');
        assert.match(body.validityPeriod, /\+07:00$/);
    });

    await t.test('5. DANA SNAP Query Payment payload matches /rest/v1.1/debit/status (serviceCode 47)', () => {
        const query = buildDanaQueryPaymentPayload({
            merchantId: '23489182303312',
            storeId: 'KANVAHATI-BOOTH-1',
            originalPartnerReferenceNo: 'KH123456',
            originalReferenceNo: 'DANA-REF-99',
            amountIdr: 125000
        });
        assert.equal(query.serviceCode, '47');
        assert.deepEqual(query.amount, { value: '125000.00', currency: 'IDR' });
        assert.equal(query.originalPartnerReferenceNo, 'KH123456');
        assert.equal(query.originalReferenceNo, 'DANA-REF-99');
    });

    await t.test('6. extractQrisInfo preserves merchant city and postal code', () => {
        const info = extractQrisInfo(DEFAULT_STATIC_QRIS_PAYLOAD);
        assert.equal(info.merchantCity, 'Kota Balikpapan');
        assert.equal(info.postalCode, '76129');
    });
});
