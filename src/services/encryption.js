export const ENCRYPTION_KEYS_STORAGE_KEY = 'personalTrackerEncryptionKeys';
export const EMPTY_ENCRYPTION_KEYS = { publicKey: '', privateKey: '' };

function getSubtleCrypto() {
  if (!window.crypto?.subtle) throw new Error('Encryption is not available in this browser.');
  return window.crypto.subtle;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

function formatPem(base64, label) {
  const lines = base64.match(/.{1,64}/g) || [];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`;
}

function pemToArrayBuffer(pem) {
  const base64 = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s/g, '');
  return base64ToArrayBuffer(base64);
}

export const getStoredEncryptionKeys = () => {
  try { return JSON.parse(localStorage.getItem(ENCRYPTION_KEYS_STORAGE_KEY) || 'null'); }
  catch { return null; }
};

export const setStoredEncryptionKeys = (keys) => {
  localStorage.setItem(ENCRYPTION_KEYS_STORAGE_KEY, JSON.stringify({ ...keys, storedAt: Date.now() }));
};

export const clearStoredEncryptionKeys = () => localStorage.removeItem(ENCRYPTION_KEYS_STORAGE_KEY);

export async function generateEncryptionKeyPair() {
  const subtle = getSubtleCrypto();
  const keyPair = await subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256'
    },
    true,
    ['encrypt', 'decrypt']
  );
  const [publicKey, privateKey] = await Promise.all([
    subtle.exportKey('spki', keyPair.publicKey),
    subtle.exportKey('pkcs8', keyPair.privateKey)
  ]);
  return {
    publicKey: formatPem(arrayBufferToBase64(publicKey), 'PUBLIC KEY'),
    privateKey: formatPem(arrayBufferToBase64(privateKey), 'PRIVATE KEY')
  };
}

async function importPublicEncryptionKey(publicKey) {
  return getSubtleCrypto().importKey(
    'spki',
    pemToArrayBuffer(publicKey),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );
}

async function importPrivateEncryptionKey(privateKey) {
  return getSubtleCrypto().importKey(
    'pkcs8',
    pemToArrayBuffer(privateKey),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt']
  );
}

export async function encryptWithStoredPublicKey(value) {
  const keys = getStoredEncryptionKeys();
  if (!keys?.publicKey) throw new Error('Public encryption key is not available for this session.');
  const key = await importPublicEncryptionKey(keys.publicKey);
  const encrypted = await getSubtleCrypto().encrypt(
    { name: 'RSA-OAEP' },
    key,
    new TextEncoder().encode(String(value))
  );
  return arrayBufferToBase64(encrypted);
}

export async function decryptWithStoredPrivateKey(value) {
  const keys = getStoredEncryptionKeys();
  if (!keys?.privateKey) throw new Error('Private encryption key is not available for this session.');
  const key = await importPrivateEncryptionKey(keys.privateKey);
  const decrypted = await getSubtleCrypto().decrypt(
    { name: 'RSA-OAEP' },
    key,
    base64ToArrayBuffer(value)
  );
  return new TextDecoder().decode(decrypted);
}
