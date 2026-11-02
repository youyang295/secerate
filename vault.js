/* =========================================================
   加密核心：主密码 → PBKDF2 派生密钥 → AES-GCM 加密整个保险箱
   ---------------------------------------------------------
   · 主密码永远不存储，也不上传；只存在你脑子里
   · 磁盘 / 浏览器里存的只有：盐、迭代次数、IV、密文
   · 密码错了，AES-GCM 的认证标签会校验失败，直接抛异常
   ========================================================= */

const VAULT_FORMAT = 'my-vault';
const VAULT_VERSION = 1;

/* OWASP 2023 对 PBKDF2-HMAC-SHA256 的建议值。调大更安全、更慢。 */
const KDF_ITERATIONS = 600000;

const SALT_BYTES = 16;
const IV_BYTES = 12;

const cryptoApi = globalThis.crypto;

/* ---------------- 编解码 ---------------- */

function randomBytes(n) {
  return cryptoApi.getRandomValues(new Uint8Array(n));
}

function toB64(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

/* ---------------- 密钥派生 ---------------- */

async function deriveKey(password, salt, iterations = KDF_ITERATIONS) {
  const base = await cryptoApi.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return cryptoApi.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/* ---------------- 加密 / 解密 ---------------- */

async function encryptJSON(key, obj) {
  const iv = randomBytes(IV_BYTES);
  const ct = await cryptoApi.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(JSON.stringify(obj))
  );
  return { iv: toB64(iv), ct: toB64(new Uint8Array(ct)) };
}

async function decryptJSON(key, data) {
  const plain = await cryptoApi.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(data.iv) },
    key,
    fromB64(data.ct)
  );
  return JSON.parse(dec.decode(plain));
}

/* ---------------- 保险箱文件 ---------------- */

/** 新建一个空保险箱文件（还没写入内容） */
function newVaultFile(password) {
  return {
    format: VAULT_FORMAT,
    version: VAULT_VERSION,
    kdf: {
      algo: 'PBKDF2-SHA256',
      iterations: KDF_ITERATIONS,
      salt: toB64(randomBytes(SALT_BYTES)),
    },
    data: null,
    updatedAt: new Date().toISOString(),
  };
}

/** 用主密码打开保险箱文件 → { key, payload }；密码错会抛异常 */
async function openVault(file, password) {
  if (!file || file.format !== VAULT_FORMAT) throw new Error('不是本程序的保险箱文件');
  if (file.version > VAULT_VERSION) throw new Error('这个保险箱版本太新，请更新程序');
  const { iterations, salt } = file.kdf;
  const key = await deriveKey(password, fromB64(salt), iterations);
  const payload = file.data ? await decryptJSON(key, file.data) : { entries: [] };
  return { key, payload };
}

/** 把内容写回保险箱文件（就地返回新对象） */
async function sealVault(file, key, payload) {
  return {
    ...file,
    kdf: { ...file.kdf },
    data: await encryptJSON(key, payload),
    updatedAt: new Date().toISOString(),
  };
}

/** 改主密码：换新盐、重新派生、重新加密 */
async function rekeyVault(file, payload, newPassword) {
  const fresh = newVaultFile(newPassword);
  const key = await deriveKey(newPassword, fromB64(fresh.kdf.salt), fresh.kdf.iterations);
  return sealVault(fresh, key, payload);
}

/* ---------------- 密码生成器 ---------------- */

const CHARSETS = {
  lower: 'abcdefghijkmnopqrstuvwxyz',
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  digit: '23456789',
  symbol: '!@#$%^&*-_=+?.,',
};

/** 无偏随机取字符：用拒绝采样，避免取模带来的偏差 */
function pick(chars) {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0xffffffff / chars.length) * chars.length;
  let x;
  do {
    cryptoApi.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return chars[x % chars.length];
}

function generatePassword(opts = {}) {
  const {
    length = 20,
    lower = true,
    upper = true,
    digit = true,
    symbol = true,
    extra = '',
  } = opts;

  let pool = extra;
  const required = [];
  if (lower) { pool += CHARSETS.lower; required.push(CHARSETS.lower); }
  if (upper) { pool += CHARSETS.upper; required.push(CHARSETS.upper); }
  if (digit) { pool += CHARSETS.digit; required.push(CHARSETS.digit); }
  if (symbol) { pool += CHARSETS.symbol; required.push(CHARSETS.symbol); }
  if (!pool) pool = CHARSETS.lower;

  const len = Math.max(length, required.length);
  const out = required.map((set) => pick(set));

  while (out.length < len) out.push(pick(pool));

  // 洗牌，避免开头几个字符总是按字符集顺序排列
  for (let i = out.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1);
    cryptoApi.getRandomValues(buf);
    const j = buf[0] % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.join('');
}

/* ---------------- 粗略强度评估 ---------------- */

function passwordBits(pw) {
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (/[^A-Za-z0-9]/.test(pw)) pool += 33;
  if (!pw || !pool) return 0;
  return Math.round(pw.length * Math.log2(pool));
}

function passwordLabel(bits) {
  if (bits < 40) return { text: '很弱', level: 0 };
  if (bits < 60) return { text: '一般', level: 1 };
  if (bits < 80) return { text: '够用', level: 2 };
  if (bits < 100) return { text: '强', level: 3 };
  return { text: '很强', level: 4 };
}
