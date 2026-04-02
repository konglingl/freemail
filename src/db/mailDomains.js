import { parseEnvMailDomains, getRootMailZone } from '../config/mailDomains.js';
import { filterAllowedMailboxDomains } from '../domain-rotation/validator.js';

function getLabelFromDomain(domain, rootZone = '') {
  if (rootZone && domain.endsWith(`.${rootZone}`)) {
    return domain.slice(0, -(rootZone.length + 1));
  }
  const parts = String(domain || '').split('.');
  return parts.length > 2 ? parts[0] : String(domain || '');
}

export async function listActiveMailDomains(db) {
  try {
    const { results } = await db.prepare(`
      SELECT domain
      FROM mail_domains
      WHERE status = 'active'
      ORDER BY preserve DESC, created_at ASC, id ASC
    `).all();
    return (results || []).map((r) => String(r.domain || '').toLowerCase()).filter(Boolean);
  } catch (_) {
    return [];
  }
}

export async function getActiveAutoDomain(db) {
  try {
    const { results } = await db.prepare(`
      SELECT * FROM mail_domains
      WHERE kind = 'auto' AND status = 'active'
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `).all();
    return results?.[0] || null;
  } catch (_) {
    return null;
  }
}

export async function retireMailDomain(db, domain, extra = {}) {
  const dnsStatus = extra?.dnsStatus || 'removed';
  await db.prepare(`
    UPDATE mail_domains
    SET status = 'retired', dns_status = ?, retired_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE domain = ?
  `).bind(dnsStatus, String(domain || '').toLowerCase()).run();
}

export async function updateMailDomainDnsState(db, domain, dnsStatus, restoreUntil = null) {
  await db.prepare(`
    UPDATE mail_domains
    SET dns_status = ?, restore_until = ?, updated_at = CURRENT_TIMESTAMP
    WHERE domain = ?
  `).bind(dnsStatus, restoreUntil, String(domain || '').toLowerCase()).run();
}

export async function findMailDomain(db, domain) {
  try {
    const { results } = await db.prepare('SELECT * FROM mail_domains WHERE domain = ? LIMIT 1').bind(String(domain || '').toLowerCase()).all();
    return results?.[0] || null;
  } catch (_) {
    return null;
  }
}

export async function listExpiredRestoredDomains(db) {
  try {
    const { results } = await db.prepare(`
      SELECT * FROM mail_domains
      WHERE status = 'retired'
        AND dns_status = 'restored_temporarily'
        AND restore_until IS NOT NULL
        AND datetime(restore_until) <= datetime('now')
      ORDER BY restore_until ASC, id ASC
    `).all();
    return results || [];
  } catch (_) {
    return [];
  }
}

export async function listMailDomainsByKind(db, kind, status = '') {
  try {
    const sql = status
      ? `SELECT * FROM mail_domains WHERE kind = ? AND status = ? ORDER BY created_at ASC, id ASC`
      : `SELECT * FROM mail_domains WHERE kind = ? ORDER BY created_at ASC, id ASC`;
    const stmt = status ? db.prepare(sql).bind(kind, status) : db.prepare(sql).bind(kind);
    const { results } = await stmt.all();
    return results || [];
  } catch (_) {
    return [];
  }
}

export async function upsertMailDomain(db, { domain, label, kind = 'manual', status = 'active', preserve = 0, dnsStatus = 'active' }) {
  const normalized = String(domain || '').trim().toLowerCase();
  if (!normalized) return { created: false, skipped: true };
  const exists = await findMailDomain(db, normalized);
  if (exists) {
    await db.prepare(`
      UPDATE mail_domains
      SET label = ?, kind = ?, status = ?, preserve = ?, dns_status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE domain = ?
    `).bind(label, kind, status, preserve, dnsStatus, normalized).run();
    return { created: false, updated: true, domain: normalized };
  }
  await db.prepare(`
    INSERT INTO mail_domains (domain, label, kind, status, preserve, dns_status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(normalized, label, kind, status, preserve, dnsStatus).run();
  return { created: true, updated: false, domain: normalized };
}

export function getBaseMailDomainsFromEnv(env) {
  const rootZone = getRootMailZone(env);
  const expanded = filterAllowedMailboxDomains(parseEnvMailDomains(env), env);
  return expanded.filter((domain) => {
    if (!rootZone) return true;
    const suffix = `.${rootZone}`;
    if (!domain.endsWith(suffix)) return false;
    const label = domain.slice(0, -suffix.length);
    return !label.includes('.');
  });
}

export async function seedMailDomainsFromEnv(db, env) {
  const domains = getBaseMailDomainsFromEnv(env);
  if (!domains.length) return { inserted: 0, skipped: 0 };

  let inserted = 0;
  let skipped = 0;
  const rootZone = String(env?.ROOT_MAIL_ZONE || '').trim().toLowerCase();

  for (const domain of domains) {
    try {
      const exists = await db.prepare('SELECT id FROM mail_domains WHERE domain = ? LIMIT 1').bind(domain).all();
      if (exists?.results?.length) {
        skipped += 1;
        continue;
      }
      const label = getLabelFromDomain(domain, rootZone);
      await db.prepare(`
        INSERT INTO mail_domains (domain, label, kind, status, preserve, dns_status)
        VALUES (?, ?, 'manual', 'active', 1, 'active')
      `).bind(domain, label).run();
      inserted += 1;
    } catch (_) {
      skipped += 1;
    }
  }

  return { inserted, skipped };
}
