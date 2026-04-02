const MX_RECORDS = [
  ['route1.mx.cloudflare.net', 20],
  ['route2.mx.cloudflare.net', 85],
  ['route3.mx.cloudflare.net', 36]
];

function getApiBase(env) {
  const zoneId = String(env?.CF_ZONE_ID || '').trim();
  if (!zoneId) throw new Error('未配置 CF_ZONE_ID');
  return `https://api.cloudflare.com/client/v4/zones/${zoneId}`;
}

function getHeaders(env) {
  const token = String(env?.CF_API_TOKEN || '').trim();
  if (!token) throw new Error('未配置 CF_API_TOKEN');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

async function cfRequest(env, path, init = {}) {
  const resp = await fetch(`${getApiBase(env)}${path}`, {
    ...init,
    headers: {
      ...getHeaders(env),
      ...(init.headers || {})
    }
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data?.success === false) {
    const msg = data?.errors?.map?.(e => e?.message).filter(Boolean).join('; ') || `HTTP ${resp.status}`;
    throw new Error(`Cloudflare API 调用失败: ${msg}`);
  }
  return data;
}

async function listDnsRecordsByName(env, domain) {
  const data = await cfRequest(env, `/dns_records?name=${encodeURIComponent(domain)}`);
  return data?.result || [];
}

async function createDnsRecord(env, record) {
  return await cfRequest(env, '/dns_records', {
    method: 'POST',
    body: JSON.stringify(record)
  });
}

async function deleteDnsRecord(env, id) {
  return await cfRequest(env, `/dns_records/${id}`, { method: 'DELETE' });
}

export async function createMailDomainDns(env, domain) {
  const existing = await listDnsRecordsByName(env, domain);
  const existingKeys = new Set(existing.map(r => `${r.type}:${r.name}:${r.content}:${r.priority || ''}`));

  for (const [content, priority] of MX_RECORDS) {
    const key = `MX:${domain}:${content}:${priority}`;
    if (!existingKeys.has(key)) {
      await createDnsRecord(env, { type: 'MX', name: domain, content, priority, ttl: 1 });
    }
  }

  const spfContent = 'v=spf1 include:_spf.mx.cloudflare.net ~all';
  const txtKey = `TXT:${domain}:${spfContent}:`;
  if (!existingKeys.has(txtKey)) {
    await createDnsRecord(env, { type: 'TXT', name: domain, content: spfContent, ttl: 1 });
  }

  return { success: true, domain };
}

export async function deleteMailDomainDns(env, domain) {
  const existing = await listDnsRecordsByName(env, domain);
  let deleted = 0;
  for (const record of existing) {
    if (!['MX', 'TXT'].includes(record?.type)) continue;
    await deleteDnsRecord(env, record.id);
    deleted += 1;
  }
  return { success: true, domain, deleted };
}
