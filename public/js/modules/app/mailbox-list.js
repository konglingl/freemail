/**
 * 邮箱列表模块（侧边栏）
 * @module modules/app/mailbox-list
 */

import { formatTs, escapeHtml, escapeAttr } from './ui-helpers.js';
import { getCurrentMailbox } from './mailbox-state.js';
import IconHelper from '../icons.js';

const MB_PAGE_SIZE = 10;
let mbPage = 1;
let mbLastCount = 0;
let mbSearchTerm = '';
let isLoading = false;

export function renderMailboxItem(mailbox, isActive = false) {
  const m = mailbox;
  const address = escapeAttr(m.address);
  const displayAddress = escapeHtml(m.address);
  const isPinned = m.is_pinned ? 'pinned' : '';
  const activeClass = isActive ? 'active' : '';
  const time = formatTs(m.created_at);
  const pinIcon = m.is_pinned ? IconHelper.pin(16, 16) : IconHelper.pin(16, 16);

  return `
    <div class="mailbox-item ${isPinned} ${activeClass}" onclick="selectMailbox('${address}')">
      <div class="mailbox-content">
        <span class="address">${displayAddress}</span>
        <span class="time">${time}</span>
      </div>
      <div class="mailbox-actions">
        <button class="btn btn-ghost btn-sm pin" onclick="togglePin(event,'${address}')" title="${m.is_pinned ? '取消置顶' : '置顶'}" aria-label="${m.is_pinned ? '取消置顶' : '置顶'}">${pinIcon}</button>
        <button class="btn btn-ghost btn-sm del" onclick="deleteMailbox(event,'${address}')" title="删除" aria-label="删除邮箱">${IconHelper.trash(16, 16)}</button>
      </div>
    </div>`;
}

export function renderMailboxList(mailboxes, container) {
  if (!container) return;

  if (!mailboxes || mailboxes.length === 0) {
    container.innerHTML = '<div class="empty-state" style="text-align:center;color:#64748b;padding:20px">暂无邮箱</div>';
    return;
  }

  const currentMb = getCurrentMailbox();
  container.innerHTML = mailboxes.map(m => renderMailboxItem(m, m.address === currentMb)).join('');
}

export function renderMbPager(elements, total) {
  try {
    const totalPages = Math.max(1, Math.ceil(total / MB_PAGE_SIZE));
    if (!elements.mbPager) return;
    elements.mbPager.style.display = total > MB_PAGE_SIZE ? 'flex' : 'none';
    if (elements.mbPageInfo) elements.mbPageInfo.textContent = `${mbPage} / ${totalPages}`;
    if (elements.mbPrev) elements.mbPrev.disabled = mbPage <= 1;
    if (elements.mbNext) elements.mbNext.disabled = mbPage >= totalPages;
    if (elements.mbPageInput) elements.mbPageInput.value = String(mbPage);
    if (elements.mbPageInput) elements.mbPageInput.max = String(totalPages);
  } catch(_) {}
}

export function getCurrentPage() {
  return mbPage;
}

export function setCurrentPage(page) {
  mbPage = Math.max(1, Number(page || 1));
}

export function getPageSize() {
  return MB_PAGE_SIZE;
}

export function prevMbPage(loadFn) {
  if (mbPage > 1) {
    mbPage -= 1;
    loadFn();
  }
}

export function nextMbPage(loadFn, total) {
  const totalPages = Math.max(1, Math.ceil(total / MB_PAGE_SIZE));
  if (mbPage < totalPages) {
    mbPage += 1;
    loadFn();
  }
}

export function jumpMbPage(loadFn, targetPage, total) {
  const totalPages = Math.max(1, Math.ceil(total / MB_PAGE_SIZE));
  const page = Math.max(1, Math.min(totalPages, Number(targetPage || 1)));
  if (page !== mbPage) {
    mbPage = page;
    loadFn();
  }
}

export function resetMbPage() {
  mbPage = 1;
  mbLastCount = 0;
}

export function setSearchTerm(term) {
  mbSearchTerm = term;
}

export function getSearchTerm() {
  return mbSearchTerm;
}

export function setLoading(loading) {
  isLoading = loading;
}

export function isLoadingMailboxes() {
  return isLoading;
}

export function setLastCount(count) {
  mbLastCount = count;
}

export function getLastCount() {
  return mbLastCount;
}

export function filterBySearch(mailboxes, term) {
  if (!term || !term.trim()) return mailboxes;
  const lowerTerm = term.toLowerCase().trim();
  return mailboxes.filter(m => (m.address || '').toLowerCase().includes(lowerTerm));
}

export default {
  renderMailboxItem,
  renderMailboxList,
  renderMbPager,
  getCurrentPage,
  setCurrentPage,
  getPageSize,
  prevMbPage,
  nextMbPage,
  jumpMbPage,
  resetMbPage,
  setSearchTerm,
  getSearchTerm,
  setLoading,
  isLoadingMailboxes,
  setLastCount,
  getLastCount,
  filterBySearch
};
