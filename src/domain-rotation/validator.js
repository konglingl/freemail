import { getRootMailZone } from '../config/mailDomains.js';

export function normalizeDomain(input) {
  return String(input || '').trim().toLowerCase().replace(/^@+/, '').replace(/\.+$/, '');
}

export function isRootDomain(domain, rootZone) {
  const d = normalizeDomain(domain);
  const root = normalizeDomain(rootZone);
  return !!d && !!root && d === root;
}

export function isSubdomainOfRoot(domain, rootZone) {
  const d = normalizeDomain(domain);
  const root = normalizeDomain(rootZone);
  return !!d && !!root && d.endsWith(`.${root}`) && d !== root;
}

export function filterAllowedMailboxDomains(domains, env) {
  const rootZone = getRootMailZone(env);
  const normalized = (Array.isArray(domains) ? domains : [domains])
    .map(normalizeDomain)
    .filter(Boolean);

  const allowed = rootZone
    ? normalized.filter((d) => isSubdomainOfRoot(d, rootZone))
    : normalized;

  return [...new Set(allowed)];
}
