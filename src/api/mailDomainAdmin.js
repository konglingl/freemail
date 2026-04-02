import { isStrictAdmin, errorResponse, jsonResponse } from './helpers.js';
import { listMailDomains, addManualMailDomain, rotateAutoDomain, restoreMailDomainDns, removeMailDomainDns } from '../domain-rotation/service.js';

export async function handleMailDomainAdminApi(request, db, env, url, path, options) {
  if (!path.startsWith('/api/admin/mail-domains')) return null;
  if (!isStrictAdmin(request, options)) return errorResponse('Forbidden', 403);
  if (options?.mockOnly) return errorResponse('演示模式不可操作', 403);

  if (path === '/api/admin/mail-domains' && request.method === 'GET') {
    const items = await listMailDomains(db);
    return jsonResponse({
      rootZone: String(env?.ROOT_MAIL_ZONE || '').trim().toLowerCase(),
      items
    });
  }

  if (path === '/api/admin/mail-domains/manual' && request.method === 'POST') {
    try {
      const body = await request.json();
      const input = body?.domain || body?.label || '';
      const result = await addManualMailDomain(db, env, input);
      return jsonResponse(result, result.created ? 201 : 200);
    } catch (error) {
      return errorResponse(String(error?.message || '添加域名失败'), 400);
    }
  }

  if (path === '/api/admin/mail-domains/rotate-random' && request.method === 'POST') {
    try {
      const result = await rotateAutoDomain(db, env);
      return jsonResponse(result, 201);
    } catch (error) {
      return errorResponse(String(error?.message || '自动轮换失败'), 400);
    }
  }

  if (path === '/api/admin/mail-domains/rotate-custom' && request.method === 'POST') {
    try {
      const body = await request.json();
      const input = body?.label || body?.domain || '';
      const result = await rotateAutoDomain(db, env, input);
      return jsonResponse(result, 201);
    } catch (error) {
      return errorResponse(String(error?.message || '指定轮换失败'), 400);
    }
  }

  if (path === '/api/admin/mail-domains/restore-dns' && request.method === 'POST') {
    try {
      const body = await request.json();
      const domain = body?.domain || '';
      const durationMinutes = body?.durationMinutes || body?.duration_minutes || 60;
      const result = await restoreMailDomainDns(db, env, domain, durationMinutes);
      return jsonResponse(result, 200);
    } catch (error) {
      return errorResponse(String(error?.message || '恢复 DNS 失败'), 400);
    }
  }

  if (path === '/api/admin/mail-domains/remove-dns' && request.method === 'POST') {
    try {
      const body = await request.json();
      const domain = body?.domain || '';
      const result = await removeMailDomainDns(db, env, domain);
      return jsonResponse(result, 200);
    } catch (error) {
      return errorResponse(String(error?.message || '移除 DNS 失败'), 400);
    }
  }

  return null;
}
