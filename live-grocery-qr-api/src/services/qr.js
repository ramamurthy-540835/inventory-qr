import crypto from 'node:crypto';
import QRCode from 'qrcode';
export const makeToken = () => crypto.randomBytes(32).toString('base64url');
const letters = digest => Array.from(digest.subarray(0, 5), byte => String.fromCharCode(65 + (byte % 26))).join('');
export const qrPrefixFor = (customerUid, orderId, collision = 0) => letters(crypto.createHash('sha256').update(`${customerUid}${orderId}|${collision}`).digest());
export const validateLocationCode = value => /^\d{3}$/.test(String(value));
export const validateCustomerTypeCode = value => /^[A-Z]{2}$/.test(String(value));
export const payloadFor = (qrId, verificationToken) => JSON.stringify({ version: 1, qrId, verificationToken });
export const toDataUrl = payload => QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 1, width: 512 });
