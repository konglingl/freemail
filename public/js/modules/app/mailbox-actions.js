/**
 * 邮箱操作模块
 * @module modules/app/mailbox-actions
 */

import { setCurrentMailbox, getCurrentMailbox, clearCurrentMailbox, setCurrentMailboxInfo } from './mailbox-state.js';
import { setButtonLoading, restoreButton } from './ui-helpers.js';
import { generateRandomId } from './random-name.js';
import { getStoredLength, saveLength, getSelectedDomainIndex } from './domains.js';
import { startAutoRefresh, stopAutoRefresh } from './auto-refresh.js';
import { resetPager } from './email-list.js';
import { resetMbPage } from './mailbox-list.js';

export async function generateMailbox(elements, lenRange, domainSelect, api, showToast, refresh, loadMailboxes, autoRefreshCallback, updateMailboxInfoUI) {
  const { gen } = elements;

  try {
    setButtonLoading(gen, '生成中…');
    const len = Number(lenRange?.value || getStoredLength());
    const domainIndex = getSelectedDomainIndex(domainSelect);

    const r = await api(`/api/generate?length=${len}&domainIndex=${domainIndex}`);
    if (!r.ok) throw new Error(await r.text());

    const data = await r.json();
    saveLength(len);

    setCurrentMailbox(data.email);
    updateEmailDisplay(elements, data.email);

    try {
      const infoRes = await api(`/api/mailbox/info?address=${encodeURIComponent(data.email)}`);
      if (infoRes.ok) {
        const info = await infoRes.json();
        setCurrentMailboxInfo(info);
        if (updateMailboxInfoUI) updateMailboxInfoUI(info);
      }
    } catch (_) {}

    showToast('邮箱生成成功！', 'success');
    startAutoRefresh(autoRefreshCallback);
    await refresh();

    resetMbPage();
    await loadMailboxes({ forceFresh: true });
  } catch (e) {
    showToast(e.message || '生成失败', 'error');
  } finally {
    restoreButton(gen);
  }
}

export async function generateNameMailbox(elements, lenRange, domainSelect, api, showToast, refresh, loadMailboxes, autoRefreshCallback, updateMailboxInfoUI) {
  const { genName } = elements;

  try {
    setButtonLoading(genName, '生成中…');
    const len = Number(lenRange?.value || getStoredLength());
    const domainIndex = getSelectedDomainIndex(domainSelect);
    const localName = generateRandomId(len);

    const r = await api('/api/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ local: localName, domainIndex })
    });

    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();
    saveLength(len);

    setCurrentMailbox(data.email);
    updateEmailDisplay(elements, data.email);

    try {
      const infoRes = await api(`/api/mailbox/info?address=${encodeURIComponent(data.email)}`);
      if (infoRes.ok) {
        const info = await infoRes.json();
        setCurrentMailboxInfo(info);
        if (updateMailboxInfoUI) updateMailboxInfoUI(info);
      }
    } catch (_) {}

    showToast('随机人名邮箱生成成功！', 'success');
    startAutoRefresh(autoRefreshCallback);
    await refresh();

    resetMbPage();
    await loadMailboxes({ forceFresh: true });
  } catch (e) {
    showToast(e.message || '生成失败', 'error');
  } finally {
    restoreButton(genName);
  }
}

export async function generateBatchMailboxes(elements, api, showToast, loadMailboxes) {
  const { batchGenerate, batchCountInput } = elements;

  try {
    const countPerDomain = Number(batchCountInput?.value || 0);
    if (!Number.isFinite(countPerDomain) || countPerDomain < 1 || countPerDomain > 50) {
      showToast('请输入 1 到 50 之间的数量', 'warn');
      return;
    }

    setButtonLoading(batchGenerate, '批量生成中…');
    const r = await api('/api/generate-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ countPerDomain })
    });

    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();
    const total = Number(data?.total || 0);
    const created = Array.isArray(data?.created) ? data.created : [];

    if (created.length > 0 && created[0]?.email) {
      setCurrentMailbox(created[0].email);
      updateEmailDisplay(elements, created[0].email);
      try {
        const infoRes = await api(`/api/mailbox/info?address=${encodeURIComponent(created[0].email)}`);
        if (infoRes.ok) {
          const info = await infoRes.json();
          setCurrentMailboxInfo(info);
        }
      } catch (_) {}
    }

    resetMbPage();
    await loadMailboxes({ forceFresh: true });
    showToast(`批量生成成功：共 ${total} 个邮箱`, 'success');
  } catch (e) {
    showToast(e.message || '批量生成失败', 'error');
  } finally {
    restoreButton(batchGenerate);
  }
}

export async function createCustomMailbox(elements, domainSelect, api, showToast, loadMailboxes) {
  const { customLocalOverlay, customOverlay } = elements;

  try {
    const local = (customLocalOverlay?.value || '').trim();
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(local)) {
      showToast('用户名不合法，仅限字母/数字/._-', 'warn');
      return;
    }
    const domainIndex = getSelectedDomainIndex(domainSelect);

    const r = await api('/api/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ local, domainIndex })
    });

    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();

    setCurrentMailbox(data.email);
    updateEmailDisplay(elements, data.email);
    if (customOverlay) customOverlay.style.display = 'none';

    showToast('已创建邮箱：' + data.email, 'success');
    await loadMailboxes({ forceFresh: true });
  } catch (e) {
    showToast(e.message || '创建失败', 'error');
  }
}

export function updateEmailDisplay(elements, address) {
  const { email, emailActions, listCard } = elements;
  const emailText = document.getElementById('email-text');
  if (emailText) emailText.textContent = address;
  else if (email) email.textContent = address;

  email?.classList.add('has-email');
  if (emailActions) emailActions.style.display = 'grid';
  if (listCard) listCard.style.display = 'block';
}

export async function selectMailboxAddress(address, elements, api, refresh, autoRefreshCallback, updateMailboxInfoUI) {
  setCurrentMailbox(address);
  updateEmailDisplay(elements, address);

  document.querySelectorAll('.mailbox-item').forEach(el => {
    el.classList.toggle('selected', el.querySelector('.address')?.textContent === address);
  });

  try {
    const r = await api(`/api/mailbox/info?address=${encodeURIComponent(address)}`);
    if (r.ok) {
      const info = await r.json();
      setCurrentMailboxInfo(info);
      updateMailboxInfoUI(info);
    }
  } catch (_) {}

  resetPager(elements);
  startAutoRefresh(autoRefreshCallback);
  await refresh();
}

export async function toggleMailboxPin(event, address, api, showToast, loadMailboxes) {
  event.stopPropagation();
  try {
    const r = await api(`/api/mailboxes/pin?address=${encodeURIComponent(address)}`, { method: 'POST' });
    if (r.ok) {
      showToast('操作成功', 'success');
      await loadMailboxes({ forceFresh: true });
    }
  } catch (e) {
    showToast(e.message || '操作失败', 'error');
  }
}

export async function deleteMailboxAddress(event, address, elements, api, showToast, showConfirm, loadMailboxes) {
  event.stopPropagation();
  const confirmed = await showConfirm(`确定删除邮箱 ${address}？所有邮件将被清空。`);
  if (!confirmed) return;

  try {
    const r = await api(`/api/mailboxes?address=${encodeURIComponent(address)}`, { method: 'DELETE' });
    if (r.ok) {
      showToast('邮箱已删除', 'success');
      if (getCurrentMailbox() === address) {
        clearCurrentMailbox();
        if (elements.email) elements.email.textContent = '点击生成邮箱';
        elements.email?.classList.remove('has-email');
        if (elements.emailActions) elements.emailActions.style.display = 'none';
        if (elements.list) elements.list.innerHTML = '';
        stopAutoRefresh();
      }
      await loadMailboxes({ forceFresh: true });
    }
  } catch (e) {
    showToast(e.message || '删除失败', 'error');
  }
}

export async function copyMailboxAddress(showToast) {
  const mailbox = getCurrentMailbox();
  if (!mailbox) {
    showToast('请先生成或选择一个邮箱', 'warn');
    return;
  }
  try {
    await navigator.clipboard.writeText(mailbox);
    showToast(`已复制：${mailbox}`, 'success');
  } catch (_) {
    showToast('复制失败', 'error');
  }
}

export async function clearAllEmails(api, showToast, showConfirm, refresh) {
  const mailbox = getCurrentMailbox();
  if (!mailbox) {
    showToast('请先选择一个邮箱', 'warn');
    return;
  }
  const confirmed = await showConfirm(`确定清空 ${mailbox} 的所有邮件？`);
  if (!confirmed) return;

  try {
    const r = await api(`/api/emails?mailbox=${encodeURIComponent(mailbox)}`, { method: 'DELETE' });
    if (r.ok) {
      showToast('邮件已清空', 'success');
      await refresh();
    }
  } catch (e) {
    showToast(e.message || '清空失败', 'error');
  }
}

export async function logout(api) {
  try {
    await api('/api/logout', { method: 'POST' });
  } catch (_) {}

  try {
    clearCurrentMailbox();
  } catch (_) {}

  try {
    stopAutoRefresh();
  } catch (_) {}

  window.location.replace('/html/login.html');
}

export default {
  generateMailbox,
  generateNameMailbox,
  generateBatchMailboxes,
  createCustomMailbox,
  updateEmailDisplay,
  selectMailboxAddress,
  toggleMailboxPin,
  deleteMailboxAddress,
  copyMailboxAddress,
  clearAllEmails,
  logout
};
