export function getRootMailZone(env) {
  return String(env?.ROOT_MAIL_ZONE || '').trim().toLowerCase();
}

export function parseEnvMailDomains(env) {
  return String(env?.MAIL_DOMAIN || 'temp.example.com')
    .split(/[,\s]+/)
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
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
