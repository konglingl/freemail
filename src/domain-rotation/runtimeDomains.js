import { parseEnvMailDomains } from '../config/mailDomains.js';
import { listActiveMailDomains } from '../db/mailDomains.js';
import { filterAllowedMailboxDomains } from './validator.js';

export async function getRuntimeMailDomains(db, env) {
  const dbDomains = filterAllowedMailboxDomains(await listActiveMailDomains(db), env);
  const envDomains = filterAllowedMailboxDomains(parseEnvMailDomains(env), env);
  return [...new Set([...dbDomains, ...envDomains])];
}
