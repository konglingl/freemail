/**
 * 全局邮箱管理页面
 * @module mailboxes
 */

import { getCurrentUserKey } from './storage.js';
import { openForwardDialog, toggleFavorite, batchSetFavorite, injectDialogStyles } from './mailbox-settings.js';
import { api, loadMailboxes as fetchMailboxes, loadDomains as fetchDomains, deleteMailbox as apiDeleteMailbox, toggleLogin as apiToggleLogin, batchToggleLogin, resetPassword as apiResetPassword, changePassword as apiChangePassword } from './modules/mailboxes/api.js';
import { formatTime, escapeHtml, generateSkeleton, renderGrid, renderList } from './modules/mailboxes/render.js';

injectDialogStyles();

// showToast 由 toast-utils.js 全局提供
const showToast = window.showToast || ((msg, type) => console.log(`[${type}] ${msg}`));

// DOM 元素
const els = {
  grid: document.getElementById('grid'),
  empty: document.getElementById('empty'),
  loadingPlaceholder: document.getElementById('loading-placeholder'),
  q: document.getElementById('q'),
  search: document.getElementById('search'),
  prev: document.getElementById('prev'),
  next: document.getElementById('next'),
  page: document.getElementById('page'),
  logout: document.getElementById('logout'),
  viewGrid: document.getElementById('view-grid'),
  viewList: document.getElementById('view-list'),
  domainFilter: document.getElementById('domain-filter'),
  loginFilter: document.getElementById('login-filter'),
  favoriteFilter: document.getElementById('favorite-filter'),
  forwardFilter: document.getElementById('forward-filter'),
  selectAll: document.getElementById('select-all'),
  clearSelection: document.getElementById('clear-selection'),
  selectedCount: document.getElementById('selected-count'),
  // 批量操作按钮
  batchAllow: document.getElementById('batch-allow'),
  batchDeny: document.getElementById('batch-deny'),
  batchFavorite: document.getElementById('batch-favorite'),
  batchUnfavorite: document.getElementById('batch-unfavorite'),
  batchForward: document.getElementById('batch-forward'),
  batchClearForward: document.getElementById('batch-clear-forward'),
  batchDelete: document.getElementById('batch-delete'),
  // 批量操作模态框
  batchModal: document.getElementById('batch-login-modal'),
  batchModalClose: document.getElementById('batch-modal-close'),
  batchModalIcon: document.getElementById('batch-modal-icon'),
  batchModalTitle: document.getElementById('batch-modal-title'),
  batchModalMessage: document.getElementById('batch-modal-message'),
  batchEmailsInput: document.getElementById('batch-emails-input'),
  batchCountInfo: document.getElementById('batch-count-info'),
  batchForwardWrapper: document.getElementById('batch-forward-input-wrapper'),
  batchForwardTarget: document.getElementById('batch-forward-target'),
  batchModalCancel: document.getElementById('batch-modal-cancel'),
  batchModalConfirm: document.getElementById('batch-modal-confirm'),
  // 密码操作模态框
  passwordModal: document.getElementById('password-modal'),
  passwordModalClose: document.getElementById('password-modal-close'),
  passwordModalIcon: document.getElementById('password-modal-icon'),
  passwordModalTitle: document.getElementById('password-modal-title'),
  passwordModalMessage: document.getElementById('password-modal-message'),
  passwordInputWrapper: document.getElementById('password-input-wrapper'),
  passwordNewInput: document.getElementById('password-new-input'),
  passwordShowToggle: document.getElementById('password-show-toggle'),
  passwordModalCancel: document.getElementById('password-modal-cancel'),
  passwordModalConfirm: document.getElementById('password-modal-confirm')
};

// 状态
let page = 1, PAGE_SIZE = 20, lastCount = 0, currentData = [];
let currentView = localStorage.getItem('mf:mailboxes:view') || 'grid';
let searchTimeout = null, isLoading = false;
let availableDomains = [];

// 加载邮箱列表
async function load() {
  if (isLoading) return;
  isLoading = true;
  
  // 显示骨架屏
  if (els.grid) els.grid.innerHTML = generateSkeleton(currentView, 8);
  if (els.empty) els.empty.style.display = 'none';
  
  try {
    const params = { page, size: PAGE_SIZE };
    if (els.q?.value) params.q = els.q.value.trim();
    if (els.domainFilter?.value) params.domain = els.domainFilter.value;
    if (els.loginFilter?.value) params.login = els.loginFilter.value;
    if (els.favoriteFilter?.value) params.favorite = els.favoriteFilter.value;
    if (els.forwardFilter?.value) params.forward = els.forwardFilter.value;
    
    const data = await fetchMailboxes(params);
    const list = Array.isArray(data) ? data : (data.list || []);
    const total = data.total ?? list.length;
    lastCount = total;
    currentData = list;
    
    if (!list.length) {
      els.grid.innerHTML = '';
      if (els.empty) els.empty.style.display = 'block';
    } else {
      els.grid.innerHTML = currentView === 'grid' ? renderGrid(list) : renderList(list);
      if (els.empty) els.empty.style.display = 'none';
    }
    
    updatePager();
    bindCardEvents();
    updateSelectionUI();
  } catch (e) {
    console.error('加载失败:', e);
    showToast('加载失败', 'error');
  } finally {
    isLoading = false;
  }
}

// 更新分页器
function updatePager() {
  const totalPages = Math.max(1, Math.ceil(lastCount / PAGE_SIZE));
  if (els.page) els.page.textContent = `第 ${page} / ${totalPages} 页 (共 ${lastCount} 个)`;
  if (els.prev) els.prev.disabled = page <= 1;
  if (els.next) els.next.disabled = page >= totalPages;
}

// 绑定卡片事件
function bindCardEvents() {
  bindSelectionEvents();

  // 不再支持点击卡片/整行直接跳转，统一使用按钮进入邮箱

  // 绑定按钮操作
  els.grid?.querySelectorAll('[data-action]').forEach(btn => {
    // 跳过卡片本身（只处理按钮）
    if (btn.classList.contains('mailbox-card') || btn.classList.contains('mailbox-list-item')) return;
    
    btn.onclick = async (e) => {
      e.stopPropagation();
      const card = btn.closest('[data-address]');
      const address = card?.dataset.address;
      const id = card?.dataset.id;
      const action = btn.dataset.action;
      
      if (!address) return;
      
      switch (action) {
        case 'copy':
          try { await navigator.clipboard.writeText(address); showToast('已复制', 'success'); }
          catch(_) { showToast('复制失败', 'error'); }
          break;
        case 'jump':
          showToast('跳转中...', 'info', 500);
          setTimeout(() => location.href = `/?mailbox=${encodeURIComponent(address)}`, 600);
          break;
        case 'pin':
          try {
            const pinRes = await api(`/api/mailboxes/pin?address=${encodeURIComponent(address)}`, {
              method: 'POST'
            });
            if (pinRes.ok) {
              showToast('置顶状态已更新', 'success');
              load();
            } else {
              showToast('操作失败', 'error');
            }
          } catch(e) { showToast('操作失败', 'error'); }
          break;
        case 'forward':
          const m = currentData.find(x => x.address === address);
          if (m && m.id) openForwardDialog(m.id, m.address, m.forward_to);
          break;
        case 'favorite':
          const mb = currentData.find(x => x.address === address);
          if (mb && mb.id) { 
            const result = await toggleFavorite(mb.id); 
            if (result.success) load();
          }
          break;
        case 'login':
          const mailbox = currentData.find(x => x.address === address);
          if (mailbox) {
            try {
              await apiToggleLogin(address, !mailbox.can_login);
              showToast(mailbox.can_login ? '已禁止登录' : '已允许登录', 'success');
              load();
            } catch(e) { showToast('操作失败', 'error'); }
          }
          break;
        case 'password':
          const pwMailbox = currentData.find(x => x.address === address);
          if (pwMailbox) {
            openPasswordModal(address, pwMailbox.password_is_default);
          }
          break;
        case 'delete':
          if (!confirm(`确定删除邮箱 ${address}？`)) return;
          try {
            await apiDeleteMailbox(address);
            showToast('已删除', 'success');
            load();
          } catch(e) { showToast('删除失败', 'error'); }
          break;
      }
    };
  });
}

// 视图切换
function switchView(view) {
  if (currentView === view) return;
  currentView = view;
  localStorage.setItem('mf:mailboxes:view', view);
  els.viewGrid?.classList.toggle('active', view === 'grid');
  els.viewList?.classList.toggle('active', view === 'list');
  els.grid.className = view;
  if (currentData.length) {
    els.grid.innerHTML = view === 'grid' ? renderGrid(currentData) : renderList(currentData);
    bindCardEvents();
  }
}

// 加载域名筛选
async function loadDomainsFilter() {
  try {
    const domains = await fetchDomains();
    if (Array.isArray(domains) && domains.length) {
      availableDomains = domains.sort();
      if (els.domainFilter) {
        els.domainFilter.innerHTML = '<option value="">全部域名</option>' + domains.map(d => `<option value="${d}">@${d}</option>`).join('');
      }
    }
  } catch(_) {}
}

// 批量操作状态
let currentBatchAction = null;
let selectedAddresses = new Set();

// 密码操作状态
let currentPasswordAddress = null;
let currentPasswordIsDefault = false;

function getSelectedAddresses() {
  return Array.from(selectedAddresses);
}

function syncSelectionFromDom() {
  const checked = Array.from(els.grid?.querySelectorAll('.mailbox-checkbox:checked') || []).map(el => String(el.dataset.address || '').trim()).filter(Boolean);
  selectedAddresses = new Set(checked);
}

function updateSelectionUI() {
  syncSelectionFromDom();
  const count = selectedAddresses.size;
  document.body.classList.toggle('selection-active', count > 0);
  if (els.selectedCount) {
    els.selectedCount.textContent = `已选 ${count} 项`;
  }
  const checkboxes = Array.from(els.grid?.querySelectorAll('.mailbox-checkbox') || []);
  const total = checkboxes.length;
  const checked = checkboxes.filter(cb => cb.checked).length;
  if (els.selectAll) {
    els.selectAll.checked = total > 0 && checked === total;
    els.selectAll.indeterminate = checked > 0 && checked < total;
  }
  if (els.clearSelection) {
    els.clearSelection.disabled = count === 0;
  }
}

function bindSelectionEvents() {
  const selectors = Array.from(els.grid?.querySelectorAll('.mailbox-select') || []);
  selectors.forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  });

  const checkboxes = Array.from(els.grid?.querySelectorAll('.mailbox-checkbox') || []);
  checkboxes.forEach(cb => {
    cb.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    cb.addEventListener('change', () => {
      const address = String(cb.dataset.address || '').trim();
      if (!address) return;
      if (cb.checked) selectedAddresses.add(address);
      else selectedAddresses.delete(address);
      updateSelectionUI();
    });
  });
}

// 打开密码操作模态框
function openPasswordModal(address, isDefault) {
  currentPasswordAddress = address;
  currentPasswordIsDefault = isDefault;
  
  if (isDefault) {
    // 设置新密码
    if (els.passwordModalIcon) els.passwordModalIcon.textContent = '🔐';
    if (els.passwordModalTitle) els.passwordModalTitle.textContent = '设置密码';
    if (els.passwordModalMessage) els.passwordModalMessage.innerHTML = `为 <strong>${address}</strong> 设置新密码：`;
    if (els.passwordInputWrapper) els.passwordInputWrapper.style.display = 'block';
    if (els.passwordNewInput) els.passwordNewInput.value = '';
    if (els.passwordShowToggle) els.passwordShowToggle.checked = false;
    if (els.passwordNewInput) els.passwordNewInput.type = 'password';
  } else {
    // 重置密码
    if (els.passwordModalIcon) els.passwordModalIcon.textContent = '🔓';
    if (els.passwordModalTitle) els.passwordModalTitle.textContent = '重置密码';
    if (els.passwordModalMessage) els.passwordModalMessage.innerHTML = `确定将 <strong>${address}</strong> 的密码重置为默认密码（邮箱地址）？`;
    if (els.passwordInputWrapper) els.passwordInputWrapper.style.display = 'none';
  }
  
  if (els.passwordModal) els.passwordModal.style.display = 'flex';
  if (isDefault && els.passwordNewInput) {
    setTimeout(() => els.passwordNewInput.focus(), 100);
  }
}

// 关闭密码操作模态框
function closePasswordModal() {
  if (els.passwordModal) els.passwordModal.style.display = 'none';
  currentPasswordAddress = null;
  currentPasswordIsDefault = false;
}

// 执行密码操作
async function executePasswordAction() {
  if (!currentPasswordAddress) return;
  
  const btnText = els.passwordModalConfirm?.querySelector('.password-btn-text');
  const btnLoading = els.passwordModalConfirm?.querySelector('.password-btn-loading');
  if (btnText) btnText.style.display = 'none';
  if (btnLoading) btnLoading.style.display = 'inline';
  if (els.passwordModalConfirm) els.passwordModalConfirm.disabled = true;
  
  try {
    let res;
    if (currentPasswordIsDefault) {
      // 设置新密码
      const newPwd = els.passwordNewInput?.value?.trim();
      if (!newPwd) {
        showToast('请输入新密码', 'error');
        return;
      }
      res = await apiChangePassword(currentPasswordAddress, newPwd);
    } else {
      // 重置密码
      res = await apiResetPassword(currentPasswordAddress);
    }
    
    if (res.ok) {
      showToast(currentPasswordIsDefault ? '密码已设置' : '密码已重置', 'success');
      closePasswordModal();
      load();
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || '操作失败', 'error');
    }
  } catch (e) {
    showToast('操作失败: ' + (e.message || '未知错误'), 'error');
  } finally {
    if (btnText) btnText.style.display = 'inline';
    if (btnLoading) btnLoading.style.display = 'none';
    if (els.passwordModalConfirm) els.passwordModalConfirm.disabled = false;
  }
}

// 打开批量操作模态框
function openBatchModal(action, title, icon, message) {
  currentBatchAction = action;
  if (els.batchModalIcon) els.batchModalIcon.textContent = icon;
  if (els.batchModalTitle) els.batchModalTitle.textContent = title;
  if (els.batchModalMessage) els.batchModalMessage.textContent = message;
  if (els.batchEmailsInput) els.batchEmailsInput.value = '';
  if (els.batchCountInfo) els.batchCountInfo.textContent = '输入邮箱后将显示数量统计';
  if (els.batchModalConfirm) els.batchModalConfirm.disabled = true;
  
  // 显示/隐藏转发目标输入
  if (els.batchForwardWrapper) {
    els.batchForwardWrapper.style.display = action === 'forward' ? 'block' : 'none';
  }
  if (els.batchForwardTarget) els.batchForwardTarget.value = '';
  
  if (els.batchModal) els.batchModal.style.display = 'flex';
}

// 关闭批量操作模态框
function closeBatchModal() {
  if (els.batchModal) els.batchModal.style.display = 'none';
  currentBatchAction = null;
}

function normalizeAddresses(addresses) {
  return Array.from(new Set((addresses || []).map(e => String(e || '').trim().toLowerCase()).filter(Boolean)));
}

async function executeDeleteForAddresses(addresses) {
  const emails = normalizeAddresses(addresses);
  if (!emails.length) {
    showToast('请先选择要删除的邮箱', 'error');
    return;
  }
  if (!confirm(`确定批量删除 ${emails.length} 个邮箱吗？此操作不可恢复。`)) return;
  const result = await api('/api/mailboxes/batch-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ addresses: emails })
  });
  const data = await result.json().catch(() => ({}));
  if (!result.ok) {
    showToast(data.error || '批量删除失败', 'error');
    return;
  }
  selectedAddresses.clear();
  showToast(`批量删除完成：成功 ${data.success_count ?? 0}，失败 ${data.fail_count ?? 0}`, 'success');
  await load();
}

async function executeBatchActionForAddresses(action, addresses, extra = {}) {
  const emails = normalizeAddresses(addresses);
  if (!emails.length) {
    showToast('请先选择邮箱', 'error');
    return;
  }

  let result;
  switch (action) {
    case 'allow':
      result = await batchToggleLogin(emails, true);
      break;
    case 'deny':
      result = await batchToggleLogin(emails, false);
      break;
    case 'favorite':
      result = await api('/api/mailboxes/batch-favorite-by-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses: emails, is_favorite: true })
      });
      break;
    case 'unfavorite':
      result = await api('/api/mailboxes/batch-favorite-by-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses: emails, is_favorite: false })
      });
      break;
    case 'forward':
      result = await api('/api/mailboxes/batch-forward-by-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses: emails, forward_to: extra.forward_to || '' })
      });
      break;
    case 'clear-forward':
      result = await api('/api/mailboxes/batch-forward-by-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses: emails, forward_to: null })
      });
      break;
    case 'delete':
      return executeDeleteForAddresses(emails);
    default:
      showToast('不支持的批量操作', 'error');
      return;
  }

  const data = await result.json().catch(() => ({}));
  if (!result.ok) {
    showToast(data.error || '批量操作失败', 'error');
    return;
  }
  if (action !== 'forward' && action !== 'clear-forward') {
    selectedAddresses.clear();
  }
  showToast('批量操作完成', 'success');
  await load();
}

// 解析邮箱列表
function parseEmails(text) {
  if (!text) return [];
  return text.split(/[\n,;，；\s]+/).map(e => e.trim().toLowerCase()).filter(e => e && e.includes('@'));
}

// 更新邮箱计数
function updateBatchCount() {
  const emails = parseEmails(els.batchEmailsInput?.value || '');
  if (els.batchCountInfo) {
    els.batchCountInfo.textContent = emails.length > 0 ? `已识别 ${emails.length} 个邮箱地址` : '输入邮箱后将显示数量统计';
  }
  if (els.batchModalConfirm) {
    const forwardValid = currentBatchAction !== 'forward' || (els.batchForwardTarget?.value?.includes('@'));
    els.batchModalConfirm.disabled = emails.length === 0 || !forwardValid;
  }
}

// 执行批量操作
async function executeBatchAction() {
  const selected = getSelectedAddresses();
  const emails = selected.length > 0 ? selected : parseEmails(els.batchEmailsInput?.value || '');
  if (!emails.length) return;
  
  const btnText = els.batchModalConfirm?.querySelector('.batch-btn-text');
  const btnLoading = els.batchModalConfirm?.querySelector('.batch-btn-loading');
  if (btnText) btnText.style.display = 'none';
  if (btnLoading) btnLoading.style.display = 'inline';
  if (els.batchModalConfirm) els.batchModalConfirm.disabled = true;
  
  try {
    let result;
    switch (currentBatchAction) {
      case 'allow':
        result = await batchToggleLogin(emails, true);
        break;
      case 'deny':
        result = await batchToggleLogin(emails, false);
        break;
      case 'favorite':
        result = await api('/api/mailboxes/batch-favorite-by-address', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ addresses: emails, is_favorite: true })
        });
        break;
      case 'unfavorite':
        result = await api('/api/mailboxes/batch-favorite-by-address', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ addresses: emails, is_favorite: false })
        });
        break;
      case 'forward':
        const forwardTo = els.batchForwardTarget?.value?.trim();
        if (!forwardTo) { showToast('请输入转发目标', 'error'); return; }
        result = await api('/api/mailboxes/batch-forward-by-address', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ addresses: emails, forward_to: forwardTo })
        });
        break;
      case 'clear-forward':
        result = await api('/api/mailboxes/batch-forward-by-address', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ addresses: emails, forward_to: null })
        });
        break;
      case 'delete':
        if (!confirm(`确定批量删除 ${emails.length} 个邮箱吗？此操作不可恢复。`)) return;
        result = await api('/api/mailboxes/batch-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ addresses: emails })
        });
        break;
    }
    const data = await result.json().catch(() => ({}));
    if (!result.ok) {
      showToast(data.error || '批量操作失败', 'error');
      return;
    }
    if (currentBatchAction === 'delete') {
      showToast(`批量删除完成：成功 ${data.success_count ?? 0}，失败 ${data.fail_count ?? 0}`, 'success');
    } else {
      showToast('批量操作完成', 'success');
    }
    closeBatchModal();
    load();
  } catch (e) {
    showToast('操作失败: ' + (e.message || '未知错误'), 'error');
  } finally {
    if (btnText) btnText.style.display = 'inline';
    if (btnLoading) btnLoading.style.display = 'none';
    if (els.batchModalConfirm) els.batchModalConfirm.disabled = false;
  }
}

// 事件绑定
els.search?.addEventListener('click', () => { page = 1; load(); });
els.q?.addEventListener('input', () => { if (searchTimeout) clearTimeout(searchTimeout); searchTimeout = setTimeout(() => { page = 1; load(); }, 300); });
els.q?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); page = 1; load(); }});
els.prev?.addEventListener('click', () => { if (page > 1 && !isLoading) { page--; load(); }});
els.next?.addEventListener('click', () => { 
  const totalPages = Math.max(1, Math.ceil(lastCount / PAGE_SIZE));
  if (page < totalPages && !isLoading) { page++; load(); }
});
els.domainFilter?.addEventListener('change', () => { page = 1; load(); });
els.loginFilter?.addEventListener('change', () => { page = 1; load(); });
els.favoriteFilter?.addEventListener('change', () => { page = 1; load(); });
els.forwardFilter?.addEventListener('change', () => { page = 1; load(); });
els.viewGrid?.addEventListener('click', () => switchView('grid'));
els.viewList?.addEventListener('click', () => switchView('list'));
els.logout?.addEventListener('click', async () => { try { await fetch('/api/logout', { method: 'POST' }); } catch(_) {} location.replace('/html/login.html'); });

// 批量操作按钮
els.batchAllow?.addEventListener('click', async () => {
  const selected = getSelectedAddresses();
  if (selected.length > 0) return executeBatchActionForAddresses('allow', selected);
  openBatchModal('allow', '批量放行登录', '✅', '输入要允许登录的邮箱地址（每行一个或用逗号分隔）：');
});
els.batchDeny?.addEventListener('click', async () => {
  const selected = getSelectedAddresses();
  if (selected.length > 0) return executeBatchActionForAddresses('deny', selected);
  openBatchModal('deny', '批量禁止登录', '🚫', '输入要禁止登录的邮箱地址（每行一个或用逗号分隔）：');
});
els.batchFavorite?.addEventListener('click', async () => {
  const selected = getSelectedAddresses();
  if (selected.length > 0) return executeBatchActionForAddresses('favorite', selected);
  openBatchModal('favorite', '批量收藏', '⭐', '输入要收藏的邮箱地址（每行一个或用逗号分隔）：');
});
els.batchUnfavorite?.addEventListener('click', async () => {
  const selected = getSelectedAddresses();
  if (selected.length > 0) return executeBatchActionForAddresses('unfavorite', selected);
  openBatchModal('unfavorite', '批量取消收藏', '☆', '输入要取消收藏的邮箱地址（每行一个或用逗号分隔）：');
});
els.batchForward?.addEventListener('click', async () => {
  const selected = getSelectedAddresses();
  if (selected.length > 0) {
    openBatchModal('forward', '批量设置转发', '↪️', `将为已选的 ${selected.length} 个邮箱设置转发目标：`);
    return;
  }
  openBatchModal('forward', '批量设置转发', '↪️', '输入要设置转发的邮箱地址（每行一个或用逗号分隔）：');
});
els.batchClearForward?.addEventListener('click', async () => {
  const selected = getSelectedAddresses();
  if (selected.length > 0) return executeBatchActionForAddresses('clear-forward', selected);
  openBatchModal('clear-forward', '批量清除转发', '🚫', '输入要清除转发的邮箱地址（每行一个或用逗号分隔）：');
});
els.batchDelete?.addEventListener('click', async () => {
  const selected = getSelectedAddresses();
  if (selected.length > 0) {
    await executeDeleteForAddresses(selected);
    return;
  }
  openBatchModal('delete', '批量删除邮箱', '🗑️', '输入要删除的邮箱地址（每行一个或用逗号分隔）：');
});

// 批量操作模态框事件
els.batchModalClose?.addEventListener('click', closeBatchModal);
els.batchModalCancel?.addEventListener('click', closeBatchModal);
els.batchEmailsInput?.addEventListener('input', updateBatchCount);
els.batchForwardTarget?.addEventListener('input', updateBatchCount);
els.batchModalConfirm?.addEventListener('click', executeBatchAction);
els.batchModal?.addEventListener('click', (e) => { if (e.target === els.batchModal) closeBatchModal(); });

// 选择相关事件
els.selectAll?.addEventListener('change', () => {
  const checked = !!els.selectAll?.checked;
  Array.from(els.grid?.querySelectorAll('.mailbox-checkbox') || []).forEach(cb => {
    cb.checked = checked;
    const address = String(cb.dataset.address || '').trim();
    if (!address) return;
    if (checked) selectedAddresses.add(address);
    else selectedAddresses.delete(address);
  });
  updateSelectionUI();
});
els.clearSelection?.addEventListener('click', () => {
  Array.from(els.grid?.querySelectorAll('.mailbox-checkbox') || []).forEach(cb => {
    cb.checked = false;
  });
  selectedAddresses.clear();
  updateSelectionUI();
});

// 密码操作模态框事件
els.passwordModalClose?.addEventListener('click', closePasswordModal);
els.passwordModalCancel?.addEventListener('click', closePasswordModal);
els.passwordModalConfirm?.addEventListener('click', executePasswordAction);
els.passwordModal?.addEventListener('click', (e) => { if (e.target === els.passwordModal) closePasswordModal(); });
els.passwordShowToggle?.addEventListener('change', () => {
  if (els.passwordNewInput) {
    els.passwordNewInput.type = els.passwordShowToggle.checked ? 'text' : 'password';
  }
});
els.passwordNewInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    executePasswordAction();
  }
});

// 初始化 guest 模式
async function initGuestMode() {
  // 初始化全局变量
  if (typeof window.__GUEST_MODE__ === 'undefined') {
    window.__GUEST_MODE__ = false;
  }
  
  try {
    const sessionResp = await fetch('/api/session');
    if (sessionResp.ok) {
      const session = await sessionResp.json();
      if (session.role === 'guest' || session.username === 'guest') {
        window.__GUEST_MODE__ = true;
        // 初始化 mock 数据
        const { MOCK_STATE, buildMockMailboxes } = await import('./modules/app/mock-api.js');
        if (!MOCK_STATE.mailboxes.length) {
          MOCK_STATE.mailboxes = buildMockMailboxes(6, 2, MOCK_STATE.domains);
        }
      }
    }
  } catch(e) {
    console.warn('Session check failed:', e);
  }
}

// 初始化
(async () => {
  // 先检查 guest 模式
  await initGuestMode();
  
  // 设置初始视图模式
  els.viewGrid?.classList.toggle('active', currentView === 'grid');
  els.viewList?.classList.toggle('active', currentView === 'list');
  if (els.grid) els.grid.className = currentView;
  
  await loadDomainsFilter();
  await load();
})();
