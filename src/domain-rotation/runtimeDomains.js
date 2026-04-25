import { parseEnvMailDomains } from '../config/mailDomains.js';
import { listActiveMailDomains } from '../db/mailDomains.js';
import { filterAllowedMailboxDomains } from './validator.js';

function sortDomainsForPicker(domains) {
  return [...domains].sort((a, b) => {
    const aPreferred = /^m[a-z0-9]{7}\.(959298\.xyz|iseeu\.asia)$/i.test(a) ? 1 : 0;
    const bPreferred = /^m[a-z0-9]{7}\.(959298\.xyz|iseeu\.asia)$/i.test(b) ? 1 : 0;
    if (aPreferred !== bPreferred) return bPreferred - aPreferred;
    return String(a).localeCompare(String(b));
  });
}

export async function getRuntimeMailDomains(db, env) {
  const dbDomains = filterAllowedMailboxDomains(await listActiveMailDomains(db), env);
  const envDomains = filterAllowedMailboxDomains(parseEnvMailDomains(env), env);
  return sortDomainsForPicker([...new Set([...dbDomains, ...envDomains])]);
}
