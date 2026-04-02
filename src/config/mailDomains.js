export function getRootMailZone(env) {
  return String(env?.ROOT_MAIL_ZONE || '').trim().toLowerCase();
}

function hashString(input) {
  let hash = 2166136261;
  const str = String(input || '');
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function buildStableRandomLabel(domain) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let n = hashString(domain);
  let out = '';
  for (let i = 0; i < 4; i += 1) {
    out += chars[n % chars.length];
    n = Math.floor(n / chars.length);
  }
  return out;
}

function expandDomainWithMirror(domain) {
  const normalized = String(domain || '').trim().toLowerCase();
  if (!normalized) return [];
  const label = buildStableRandomLabel(normalized);
  return [normalized, `${label}.${normalized}`];
}

export function parseEnvMailDomains(env) {
  const rawDomains = String(env?.MAIL_DOMAIN || 'temp.example.com')
    .split(/[,\s]+/)
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  return [...new Set(rawDomains.flatMap(expandDomainWithMirror))];
}

export function isRootZoneConfigured(env) {
  return !!getRootMailZone(env);
}

export function getAutoDomainPrefix(env) {
  return String(env?.AUTO_DOMAIN_PREFIX || 'auto').trim().toLowerCase() || 'auto';
}

export function getAutoRotationEnabled(env) {
  return String(env?.AUTO_ROTATION_ENABLED || '').trim().toLowerCase() === 'true';
}
