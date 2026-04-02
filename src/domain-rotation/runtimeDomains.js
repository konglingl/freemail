import { parseEnvMailDomains } from '../config/mailDomains.js';
import { listActiveMailDomains } from '../db/mailDomains.js';
import { filterAllowedMailboxDomains } from './validator.js';

export async function getRuntimeMailDomains(db, env) {
  const dbDomains = filterAllowedMailboxDomains(await listActiveMailDomains(db), env);
  if (dbDomains.length) return dbDomains;
  return filterAllowedMailboxDomains(parseEnvMailDomains(env), env);
}
