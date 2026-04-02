import { getRootMailZone, getAutoDomainPrefix, getAutoRotationEnabled } from '../config/mailDomains.js';
import { normalizeDomain, isSubdomainOfRoot } from './validator.js';
import { seedMailDomainsFromEnv, getActiveAutoDomain, retireMailDomain, updateMailDomainDnsState, findMailDomain, listExpiredRestoredDomains } from '../db/mailDomains.js';
import { createMailDomainDns, deleteMailDomainDns } from './provider.cloudflare.js';
import { countMailboxesByDomain } from '../db/index.js';

function buildDomainFromInput(input, rootZone) {
  const raw = normalizeDomain(input);
  if (!raw) throw new Error('域名不能为空');
  if (!rootZone) throw new Error('未配置 ROOT_MAIL_ZONE');
  if (raw === rootZone) throw new Error('根域名不能作为邮箱后缀');
  if (raw.endsWith(`.${rootZone}`)) {
    if (!isSubdomainOfRoot(raw, rootZone)) throw new Error('只能使用二级域名或更深子域名');
    return raw;
  }
  return `${raw}.${rootZone}`;
}

function getLabel(domain, rootZone) {
  if (domain.endsWith(`.${rootZone}`)) {
    return domain.slice(0, -(rootZone.length + 1));
  }
  return domain;
}

export async function ensureMailDomainSeeded(db, env) {
  return await seedMailDomainsFromEnv(db, env);
}

export async function listMailDomains(db) {
  const { results } = await db.prepare(`
    SELECT id, domain, label, kind, status, preserve, dns_status, restore_until, created_at, updated_at, retired_at, last_error
    FROM mail_domains
    ORDER BY preserve DESC, kind ASC, created_at ASC, id ASC
  `).all();
  return results || [];
}

function generateAutoLabel(prefix) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const ts = `${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}`;
  const rand = Math.random().toString(16).slice(2, 6);
  return `${prefix}${ts}${rand}`;
}

export async function rotateAutoDomain(db, env, customLabel = '') {
  const rootZone = getRootMailZone(env);
  if (!rootZone) throw new Error('未配置 ROOT_MAIL_ZONE');

  const prefix = getAutoDomainPrefix(env);
  const label = customLabel ? normalizeDomain(customLabel) : generateAutoLabel(prefix);
  if (!label) throw new Error('自动域名标签不能为空');

  const domain = buildDomainFromInput(label, rootZone);
  const exists = await db.prepare('SELECT id FROM mail_domains WHERE domain = ? LIMIT 1').bind(domain).all();
  if (exists?.results?.length) {
    throw new Error('目标自动域名已存在');
  }

  const previous = await getActiveAutoDomain(db);

  await createMailDomainDns(env, domain);

  try {
    await db.prepare(`
      INSERT INTO mail_domains (domain, label, kind, status, preserve, dns_status)
      VALUES (?, ?, 'auto', 'active', 0, 'active')
    `).bind(domain, label).run();
  } catch (error) {
    try { await deleteMailDomainDns(env, domain); } catch (_) {}
    throw error;
  }
  if (previous && previous.domain && previous.domain !== domain) {
    const mailboxCount = await countMailboxesByDomain(db, previous.domain);
    if (mailboxCount > 0) {
      await retireMailDomain(db, previous.domain, { dnsStatus: 'kept_for_mailboxes' });
    } else {
      try {
        await deleteMailDomainDns(env, previous.domain);
      } catch (_) {}
      await retireMailDomain(db, previous.domain, { dnsStatus: 'removed' });
    }
  }

  const created = await db.prepare(`
    SELECT id, domain, label, kind, status, preserve, dns_status, restore_until, created_at, updated_at, retired_at, last_error
    FROM mail_domains WHERE domain = ? LIMIT 1
  `).bind(domain).all();

  return { success: true, domain, previous: previous?.domain || null, item: created?.results?.[0] || null };
}

export async function restoreMailDomainDns(db, env, domain, durationMinutes = 60) {
  const item = await findMailDomain(db, domain);
  if (!item) throw new Error('域名不存在');
  if (item.kind !== 'auto' || item.status !== 'retired') {
    throw new Error('仅支持恢复 retired auto 域名');
  }

  await createMailDomainDns(env, item.domain);
  const restoreUntil = new Date(Date.now() + Math.max(1, Number(durationMinutes || 60)) * 60 * 1000).toISOString();
  await updateMailDomainDnsState(db, item.domain, 'restored_temporarily', restoreUntil);
  return { success: true, domain: item.domain, restore_until: restoreUntil };
}

export async function removeMailDomainDns(db, env, domain) {
  const item = await findMailDomain(db, domain);
  if (!item) throw new Error('域名不存在');
  if (item.kind !== 'auto' || item.status !== 'retired') {
    throw new Error('仅支持移除 retired auto 域名的 DNS');
  }

  const mailboxCount = await countMailboxesByDomain(db, item.domain);
  if (mailboxCount > 0) {
    await updateMailDomainDnsState(db, item.domain, 'kept_for_mailboxes', null);
    return { success: true, domain: item.domain, skipped: true, reason: '该域名下仍有邮箱记录，保留 DNS' };
  }

  await deleteMailDomainDns(env, item.domain);
  await updateMailDomainDnsState(db, item.domain, 'removed', null);
  return { success: true, domain: item.domain, removed: true };
}

export async function cleanupExpiredRestoredDomains(db, env) {
  const expired = await listExpiredRestoredDomains(db);
  const results = [];
  for (const item of expired) {
    const result = await removeMailDomainDns(db, env, item.domain).catch((error) => ({ success: false, domain: item.domain, error: String(error?.message || error) }));
    results.push(result);
  }
  return results;
}

export async function runAutoRotationTick(db, env) {
  const cleanup = await cleanupExpiredRestoredDomains(db, env);
  if (!getAutoRotationEnabled(env)) {
    return { skipped: true, reason: 'AUTO_ROTATION_ENABLED=false', cleanup };
  }
  const rotated = await rotateAutoDomain(db, env);
  return { ...rotated, cleanup };
}

export async function addManualMailDomain(db, env, input) {
  const rootZone = getRootMailZone(env);
  const domain = buildDomainFromInput(input, rootZone);
  const label = getLabel(domain, rootZone);

  const exists = await db.prepare('SELECT id, domain, kind, status FROM mail_domains WHERE domain = ? LIMIT 1').bind(domain).all();
  if (exists?.results?.length) {
    return { created: false, exists: true, domain: exists.results[0].domain, item: exists.results[0] };
  }

  await createMailDomainDns(env, domain);

  try {
    await db.prepare(`
      INSERT INTO mail_domains (domain, label, kind, status, preserve, dns_status)
      VALUES (?, ?, 'manual', 'active', 1, 'active')
    `).bind(domain, label).run();
  } catch (error) {
    try {
      await deleteMailDomainDns(env, domain);
    } catch (_) {}
    throw error;
  }

  const created = await db.prepare(`
    SELECT id, domain, label, kind, status, preserve, dns_status, restore_until, created_at, updated_at, retired_at, last_error
    FROM mail_domains WHERE domain = ? LIMIT 1
  `).bind(domain).all();

  return { created: true, exists: false, domain, item: created?.results?.[0] || null };
}
