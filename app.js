/* =========================================================
   密码箱 · 界面逻辑
   ---------------------------------------------------------
   明文只在内存里：解锁后 entries 在内存，落盘一律先加密。
   ========================================================= */

(() => {
  'use strict';

  /* ---------------- 图标 ---------------- */

  const SVG = (body, opts = '') =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round" ${opts}>${body}</svg>`;

  const ICONS = {
    shield: SVG('<path d="M12 3l7 3.2V12c0 4.4-2.9 7.4-7 9-4.1-1.6-7-4.6-7-9V6.2L12 3z"/><path d="M9.2 12.2l2 2 3.6-3.8"/>'),
    lock: SVG('<rect x="5" y="10.5" width="14" height="9.5" rx="2.4"/><path d="M8.2 10.5V8a3.8 3.8 0 017.6 0v2.5"/>'),
    gear: SVG('<circle cx="12" cy="12" r="3.2"/><path d="M19.4 14.6a1.6 1.6 0 00.3 1.8l.1.1a1.9 1.9 0 11-2.7 2.7l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5v.2a1.9 1.9 0 11-3.8 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a1.9 1.9 0 11-2.7-2.7l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1h-.2a1.9 1.9 0 110-3.8h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a1.9 1.9 0 112.7-2.7l.1.1a1.6 1.6 0 001.8.3h.1a1.6 1.6 0 001-1.5v-.2a1.9 1.9 0 113.8 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a1.9 1.9 0 112.7 2.7l-.1.1a1.6 1.6 0 00-.3 1.8v.1a1.6 1.6 0 001.5 1h.2a1.9 1.9 0 110 3.8h-.1a1.6 1.6 0 00-1.5 1z"/>'),
    plus: SVG('<path d="M12 5.5v13M5.5 12h13"/>'),
    close: SVG('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'),
    search: SVG('<circle cx="11" cy="11" r="6.2"/><path d="M15.6 15.6L20 20"/>'),
    copy: SVG('<rect x="9" y="9" width="10.5" height="10.5" rx="2.2"/><path d="M6.5 15H5.4A1.4 1.4 0 014 13.6V5.4A1.4 1.4 0 015.4 4h8.2A1.4 1.4 0 0115 5.4v1.1"/>'),
    eye: SVG('<path d="M2.6 12s3.4-6 9.4-6 9.4 6 9.4 6-3.4 6-9.4 6-9.4-6-9.4-6z"/><circle cx="12" cy="12" r="2.6"/>'),
    refresh: SVG('<path d="M20 12a8 8 0 11-2.6-5.9"/><path d="M20 4.5V10h-5.5"/>'),
    spark: SVG('<path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9L12 3.5z"/>'),
    download: SVG('<path d="M12 4v10.5"/><path d="M8 11l4 4 4-4"/><path d="M4.5 18.5h15"/>'),
    upload: SVG('<path d="M12 20V9.5"/><path d="M8 13l4-4 4 4"/><path d="M4.5 5.5h15"/>'),
    trash: SVG('<path d="M4.5 7h15"/><path d="M9.5 7V5.4A1.4 1.4 0 0110.9 4h2.2a1.4 1.4 0 011.4 1.4V7"/><path d="M6.5 7l.8 12.1a1.4 1.4 0 001.4 1.3h6.6a1.4 1.4 0 001.4-1.3L18.5 7"/>'),
  };

  function injectIcons() {
    document.querySelectorAll('[data-icon]').forEach((el) => {
      const name = el.dataset.icon;
      if (!ICONS[name]) return;
      el.insertAdjacentHTML('afterbegin', ICONS[name]);
    });
  }

  /* ---------------- 小工具 ---------------- */

  const $ = (id) => document.getElementById(id);

  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));

  const STORE_KEY = 'vault.file.v1';
  const PREFS_KEY = 'vault.prefs.v1';
  const CLIPBOARD_CLEAR_MS = 30000;

  const uid = () => crypto.randomUUID?.() || String(Date.now() + Math.random());

  const state = {
    file: null,
    key: null,
    entries: [],
    folders: [],
    folderFilter: 'all',
    prefs: { autoLock: 5 },
    editingId: null,
    revealed: new Set(),
    query: '',
    idleTimer: null,
    clipTimer: null,
    busy: false,
    fail: 0,
    setupMode: false,
    toastTimer: null,
    gen: { length: 20, lower: true, upper: true, digit: true, symbol: true },
  };

  /* ---------------- 存储 ---------------- */

  function loadFile() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveFile() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state.file));
      return true;
    } catch (e) {
      toast('保存失败：浏览器存储不可用或已满');
      return false;
    }
  }

  function loadPrefs() {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) Object.assign(state.prefs, JSON.parse(raw));
    } catch { /* 忽略 */ }
  }

  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(state.prefs));
    } catch { /* 忽略 */ }
  }

  /* ---------------- Toast ---------------- */

  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('is-show'));
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => {
      el.classList.remove('is-show');
      setTimeout(() => { el.hidden = true; }, 220);
    }, 2000);
  }

  /* ---------------- 视图 ---------------- */

  function setView(name) {
    document.querySelectorAll('.view').forEach((v) => {
      v.classList.toggle('is-active', v.id === 'view-' + name);
    });
  }

  /* ---------------- 剪贴板 ---------------- */

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch { /* 忽略 */ }
    ta.remove();
  }

  async function copyText(text, label) {
    if (!text) { toast('没有内容可复制'); return; }
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      fallbackCopy(text);
    }
    toast(`${label}已复制，30 秒后自动清空剪贴板`);
    clearTimeout(state.clipTimer);
    state.clipTimer = setTimeout(() => {
      navigator.clipboard?.writeText('').catch(() => {});
    }, CLIPBOARD_CLEAR_MS);
  }

  /* =========================================================
     解锁 / 初始化
     ========================================================= */

  function renderLockMode() {
    const setup = !state.file;
    state.setupMode = setup;

    $('lock-hint').textContent = setup ? '第一次用，先设一个主密码' : '输入主密码解锁';
    $('lock-pw').placeholder = setup ? '设置主密码' : '主密码';
    $('lock-pw2').hidden = !setup;
    $('lock-submit').textContent = setup ? '创建保险箱' : '解锁';
    $('lock-note').textContent = setup
      ? '主密码只存在你脑子里，忘了就真的打不开，也没有任何后门能帮你找回。'
      : '主密码只存在你脑子里，忘了就真的打不开。';

    const lockMsg = $('lock-msg');
    if (lockMsg.dataset.imported === '1') {
      lockMsg.hidden = false;
      lockMsg.classList.add('is-ok');
      lockMsg.textContent = '备份已导入，用它的主密码解锁';
      lockMsg.dataset.imported = '0';
    }
  }

  function setLockBusy(on, text) {
    state.busy = on;
    const btn = $('lock-submit');
    btn.disabled = on;
    if (on) {
      btn.dataset.label = btn.textContent;
      btn.textContent = text;
    } else if (btn.dataset.label) {
      btn.textContent = btn.dataset.label;
    }
  }

  function lockMessage(msg) {
    const el = $('lock-msg');
    el.hidden = !msg;
    el.classList.remove('is-ok');
    el.textContent = msg || '';
  }

  async function handleLockSubmit(e) {
    e.preventDefault();
    if (state.busy) return;

    const pw = $('lock-pw').value;
    const pw2 = $('lock-pw2').value;

    if (!pw) { lockMessage('主密码不能为空'); return; }

    if (state.setupMode) {
      if (pw.length < 8) { lockMessage('至少 8 位，短了不安全'); return; }
      if (pw !== pw2) { lockMessage('两次输入不一致'); return; }
      await createVault(pw);
    } else {
      await unlock(pw);
    }
  }

  async function createVault(password) {
    setLockBusy(true, '创建中…');
    try {
      const fresh = newVaultFile(password);
      const { key } = await openVault(fresh, password);
      state.file = await sealVault(fresh, key, { entries: [], folders: [] });
      state.key = key;
      state.entries = [];
      state.folders = [];
      saveFile();
      renderLockMode();
      enterVault();
      toast('保险箱建好了，先存一条试试');
    } catch (err) {
      lockMessage('创建失败：' + (err?.message || err));
    } finally {
      setLockBusy(false);
    }
  }

  async function unlock(password) {
    setLockBusy(true, '解密中…');
    try {
      const { key, payload } = await openVault(state.file, password);
      state.key = key;
      state.entries = Array.isArray(payload.entries) ? payload.entries : [];
      state.folders = Array.isArray(payload.folders) ? payload.folders : [];
      state.fail = 0;
      $('lock-pw').value = '';
      $('lock-pw2').value = '';
      lockMessage('');
      enterVault();
    } catch (err) {
      state.fail += 1;
      const isWrong = err?.name === 'OperationError';
      lockMessage(isWrong ? '主密码不对，再试一次' : '打不开：' + (err?.message || err));
      $('lock-pw').value = '';
      $('lock-pw').focus();
      if (isWrong) {
        const wait = Math.min(300 * state.fail, 3000);
        setLockBusy(true, `请等 ${(wait / 1000).toFixed(1)} 秒…`);
        await new Promise((r) => setTimeout(r, wait));
      }
    } finally {
      setLockBusy(false);
    }
  }

  function enterVault() {
    setView('list');
    state.query = '';
    state.folderFilter = 'all';
    $('search').value = '';
    renderList();
    armIdleTimer();
  }

  function lock() {
    state.key = null;
    state.entries = [];
    state.folders = [];
    state.folderFilter = 'all';
    state.revealed.clear();
    clearTimeout(state.idleTimer);
    state.idleTimer = null;
    closeSheet('edit');
    closeSheet('gen');
    closeSheet('settings');
    renderLockMode();
    setView('lock');
    lockMessage('');
    $('lock-pw').value = '';
    $('lock-pw2').value = '';
    $('lock-pw').focus?.();
  }

  /* ---------------- 自动锁定 ---------------- */

  function armIdleTimer() {
    clearTimeout(state.idleTimer);
    if (!state.key) return;
    state.idleTimer = setTimeout(() => {
      if (state.key) {
        lock();
        lockMessage('闲置太久，已自动锁定');
      }
    }, state.prefs.autoLock * 60000);
  }

  /* =========================================================
     列表
     ========================================================= */

  function visibleEntries() {
    const q = state.query.trim().toLowerCase();
    let list = [...state.entries].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

    if (state.folderFilter === 'none') {
      list = list.filter((e) => !e.folderId);
    } else if (state.folderFilter !== 'all') {
      list = list.filter((e) => e.folderId === state.folderFilter);
    }

    if (!q) return list;
    return list.filter((e) =>
      [e.title, e.username, e.tag, e.url, e.note].some((v) => String(v || '').toLowerCase().includes(q))
    );
  }

  function entryCard(e) {
    const shown = state.revealed.has(e.id);
    const secretText = e.secret
      ? (shown ? esc(e.secret) : '••••••••••')
      : '—';
    return `
      <article class="entry" data-id="${esc(e.id)}">
        <div class="entry-head">
          <h3 class="entry-title">${esc(e.title || '未命名')}</h3>
          ${e.tag ? `<span class="tag">${esc(e.tag)}</span>` : ''}
        </div>
        <div class="entry-row">
          <span class="entry-key">账号</span>
          <span class="entry-val ${e.username ? '' : 'is-empty'}">${esc(e.username || '未填')}</span>
          ${e.username ? `<button class="mini" data-act="copy-user" data-id="${esc(e.id)}">${ICONS.copy}复制</button>` : ''}
        </div>
        <div class="entry-row">
          <span class="entry-key">密钥</span>
          <span class="entry-val mono ${e.secret ? '' : 'is-empty'}">${secretText}</span>
          ${e.secret ? `
            <button class="mini" data-act="reveal" data-id="${esc(e.id)}">${shown ? '隐藏' : '显示'}</button>
            <button class="mini" data-act="copy-secret" data-id="${esc(e.id)}">${ICONS.copy}复制</button>
          ` : ''}
        </div>
      </article>`;
  }

  function renderList() {
    const items = visibleEntries();
    const listEl = $('list');
    const emptyEl = $('empty');

    renderFolders();

    $('vault-meta').textContent = state.entries.length
      ? `${state.entries.length} 条 · 已解锁`
      : '空的 · 已解锁';

    listEl.innerHTML = items.map(entryCard).join('');
    emptyEl.hidden = items.length > 0;
    if (!items.length) {
      const q = state.query.trim();
      emptyEl.querySelector('.empty-title').textContent = q ? '没找到匹配的' : '还没有东西';
      emptyEl.querySelector('.empty-text').textContent = q
        ? '换个关键词试试'
        : '点右下角的 + 存第一条密码';
    }
  }

  /* =========================================================
     文件夹
     ========================================================= */

  function hueFor(i) {
    const n = Math.max(state.folders.length, 1);
    return (Math.round((i * 360) / n) + 12) % 360;
  }

  function renderFolders() {
    const box = $('folders');
    if (!box) return;

    const total = state.entries.length;
    const loose = state.entries.filter((e) => !e.folderId).length;
    const chips = [
      `<button class="chip ${state.folderFilter === 'all' ? 'is-on' : ''}" data-folder="all">全部<b>${total}</b></button>`,
    ];

    if (loose) {
      chips.push(
        `<button class="chip ${state.folderFilter === 'none' ? 'is-on' : ''}" data-folder="none">未分类<b>${loose}</b></button>`
      );
    }

    state.folders.forEach((f, i) => {
      const n = state.entries.filter((e) => e.folderId === f.id).length;
      chips.push(
        `<button class="chip ${state.folderFilter === f.id ? 'is-on' : ''}" data-folder="${esc(f.id)}"><i style="--h:${hueFor(i)}"></i>${esc(f.name)}<b>${n}</b></button>`
      );
    });

    box.innerHTML = chips.join('');
  }

  function fillFolderSelect(selected) {
    const opts = [`<option value="">未分类</option>`]
      .concat(state.folders.map((f) => `<option value="${esc(f.id)}">${esc(f.name)}</option>`))
      .concat([`<option value="__new">＋ 新建文件夹…</option>`]);
    $('f-folder').innerHTML = opts.join('');
    $('f-folder').value = selected || '';
  }

  function createFolderFromInput() {
    const name = $('f-folder-name').value.trim();
    if (!name) { toast('文件夹名字不能为空'); return; }

    let folder = state.folders.find((f) => f.name === name);
    const existed = Boolean(folder);

    if (!folder) {
      folder = { id: uid(), name };
      state.folders.push(folder);
    }

    $('f-folder-name').value = '';
    $('folder-new').hidden = true;
    fillFolderSelect(folder.id);
    persist();
    toast(existed ? '已经有这个文件夹，已选上' : `文件夹「${name}」建好了`);
  }

  function renderFolderSettings() {
    const box = $('folder-manage');
    if (!box) return;

    if (!state.folders.length) {
      box.innerHTML = `<p class="settings-note">还没有文件夹。在编辑条目时选「＋ 新建文件夹…」就能建。</p>`;
      return;
    }

    box.innerHTML = state.folders
      .map((f, i) => {
        const n = state.entries.filter((e) => e.folderId === f.id).length;
        return `<div class="folder-row" data-fid="${esc(f.id)}">
          <i class="dot" style="--h:${hueFor(i)}"></i>
          <span class="folder-name">${esc(f.name)}</span>
          <span class="folder-count">${n}</span>
          <button class="mini" data-fact="rename">改名</button>
          <button class="mini" data-fact="del">删除</button>
        </div>`;
      })
      .join('');
  }

  function startRenameFolder(row, folder) {
    const span = row.querySelector('.folder-name');
    if (!span) return;

    const input = document.createElement('input');
    input.className = 'folder-input';
    input.value = folder.name;
    input.spellcheck = false;
    span.replaceWith(input);
    input.focus();
    input.select();

    let done = false;
    const commit = () => {
      if (done) return;
      done = true;

      const name = input.value.trim();
      if (!name || name === folder.name) { renderFolderSettings(); return; }

      if (state.folders.some((f) => f.id !== folder.id && f.name === name)) {
        toast('已经有同名文件夹了');
        renderFolderSettings();
        return;
      }

      folder.name = name;
      persist();
      renderList();
      renderFolderSettings();
      toast('改好了');
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { done = true; renderFolderSettings(); }
    });
  }

  function deleteFolder(folder) {
    const n = state.entries.filter((e) => e.folderId === folder.id).length;
    const hint = n
      ? `删除文件夹「${folder.name}」？里面 ${n} 条会回到「未分类」，不会被删掉。`
      : `删除空文件夹「${folder.name}」？`;
    if (!confirm(hint)) return;

    state.entries.forEach((e) => { if (e.folderId === folder.id) e.folderId = null; });
    state.folders = state.folders.filter((f) => f.id !== folder.id);
    if (state.folderFilter === folder.id) state.folderFilter = 'all';

    persist();
    renderList();
    renderFolderSettings();
    toast('文件夹删了，条目还在');
  }

  /* =========================================================
     编辑
     ========================================================= */

  function openEdit(id) {
    const entry = id ? state.entries.find((e) => e.id === id) : null;
    state.editingId = entry ? entry.id : null;

    $('edit-title').textContent = entry ? '编辑' : '新建';
    $('f-title').value = entry?.title || '';
    $('f-username').value = entry?.username || '';
    $('f-secret').value = entry?.secret || '';
    $('f-secret').classList.add('is-masked');
    $('btn-reveal-edit').lastChild.textContent = '显示';
    $('f-url').value = entry?.url || '';
    $('f-tag').value = entry?.tag || '';
    $('f-note').value = entry?.note || '';
    $('btn-delete').hidden = !entry;

    const current = state.folderFilter;
    const defaultFolder = current !== 'all' && current !== 'none' ? current : '';
    fillFolderSelect(entry ? entry.folderId || '' : defaultFolder);
    $('folder-new').hidden = true;
    $('f-folder-name').value = '';

    openSheet('edit');
    setTimeout(() => $('f-title').focus(), 60);
  }

  async function saveEdit(e) {
    e.preventDefault();
    const title = $('f-title').value.trim();
    if (!title) { toast('标题不能为空'); return; }

    const now = new Date().toISOString();
    const picked = $('f-folder').value;
    const data = {
      title,
      username: $('f-username').value.trim(),
      secret: $('f-secret').value,
      url: $('f-url').value.trim(),
      folderId: picked && picked !== '__new' ? picked : null,
      tag: $('f-tag').value.trim(),
      note: $('f-note').value,
    };

    if (state.editingId) {
      const i = state.entries.findIndex((x) => x.id === state.editingId);
      if (i >= 0) state.entries[i] = { ...state.entries[i], ...data, updatedAt: now };
    } else {
      state.entries.push({
        id: uid(),
        ...data,
        createdAt: now,
        updatedAt: now,
      });
    }

    await persist();
    closeSheet('edit');
    renderList();
    toast(state.editingId ? '已更新' : '已保存');
  }

  async function deleteEditing() {
    const entry = state.entries.find((e) => e.id === state.editingId);
    if (!entry) return;
    if (!confirm(`删除「${entry.title}」？删了就找不回来了。`)) return;
    state.entries = state.entries.filter((e) => e.id !== state.editingId);
    await persist();
    closeSheet('edit');
    renderList();
    toast('已删除');
  }

  async function persist() {
    if (!state.key) return;
    state.file = await sealVault(state.file, state.key, { entries: state.entries, folders: state.folders });
    saveFile();
    armIdleTimer();
  }

  /* =========================================================
     弹层
     ========================================================= */

  function openSheet(name) {
    $('sheet-' + name).hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeSheet(name) {
    const el = $('sheet-' + name);
    if (!el) return;
    el.hidden = true;
    if (!document.querySelector('.sheet:not([hidden])')) {
      document.body.style.overflow = '';
    }
  }

  /* =========================================================
     密码生成器
     ========================================================= */

  function genOptions() {
    return {
      length: state.gen.length,
      lower: state.gen.lower,
      upper: state.gen.upper,
      digit: state.gen.digit,
      symbol: state.gen.symbol,
    };
  }

  function refreshGen() {
    $('gen-out').textContent = generatePassword(genOptions());
    $('gen-len-label').textContent = state.gen.length;
  }

  function openGen() {
    $('gen-len').value = state.gen.length;
    $('gen-lower').checked = state.gen.lower;
    $('gen-upper').checked = state.gen.upper;
    $('gen-digit').checked = state.gen.digit;
    $('gen-symbol').checked = state.gen.symbol;
    openSheet('gen');
    refreshGen();
  }

  function syncGenFromInputs() {
    state.gen.length = Number($('gen-len').value);
    state.gen.lower = $('gen-lower').checked;
    state.gen.upper = $('gen-upper').checked;
    state.gen.digit = $('gen-digit').checked;
    state.gen.symbol = $('gen-symbol').checked;
    if (!state.gen.lower && !state.gen.upper && !state.gen.digit && !state.gen.symbol) {
      state.gen.lower = true;
      $('gen-lower').checked = true;
    }
    refreshGen();
  }

  /* =========================================================
     设置
     ========================================================= */

  function openSettings() {
    $('s-autolock').value = String(state.prefs.autoLock);
    $('s-old-pw').value = '';
    $('s-new-pw').value = '';
    $('s-new-pw2').value = '';
    renderFolderSettings();
    openSheet('settings');
  }

  function exportBackup() {
    const stamp = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(state.file, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `密码箱备份-${stamp}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('已导出加密备份，没有主密码谁也打不开');
  }

  async function importBackup(file) {
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      toast('这个文件不是合法的备份');
      return;
    }
    if (parsed?.format !== VAULT_FORMAT || !parsed.kdf?.salt) {
      toast('这不是密码箱的备份文件');
      return;
    }
    const iterations = Number(parsed.kdf.iterations);
    if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 5000000) {
      toast('备份里的加密参数不正常，已拒绝');
      return;
    }
    if (!confirm('导入会覆盖当前保险箱里的全部内容，继续？')) return;

    state.file = parsed;
    state.key = null;
    state.entries = [];
    saveFile();
    closeSheet('settings');
    lock();
    $('lock-msg').dataset.imported = '1';
    renderLockMode();
    toast('导入成功，请用该备份的主密码解锁');
  }

  async function rekey() {
    const oldPw = $('s-old-pw').value;
    const pw = $('s-new-pw').value;
    const pw2 = $('s-new-pw2').value;

    if (!oldPw) { toast('先填当前主密码'); return; }
    if (pw.length < 8) { toast('新密码至少 8 位'); return; }
    if (pw !== pw2) { toast('两次新密码不一致'); return; }

    try {
      await openVault(state.file, oldPw);
    } catch {
      toast('当前主密码不对');
      return;
    }

    const newFile = await rekeyVault(state.file, { entries: state.entries, folders: state.folders }, pw);
    const opened = await openVault(newFile, pw);
    state.file = newFile;
    state.key = opened.key;
    saveFile();
    $('s-old-pw').value = '';
    $('s-new-pw').value = '';
    $('s-new-pw2').value = '';
    toast('主密码已修改，旧密码立即失效');
  }

  function wipe() {
    if (!confirm('清空本地所有数据？没有备份就真的没了。')) return;
    if (!confirm('再确认一次：现在清空？')) return;
    localStorage.removeItem(STORE_KEY);
    localStorage.removeItem(PREFS_KEY);
    location.reload();
  }

  /* =========================================================
     事件绑定
     ========================================================= */

  function bind() {
    $('lock-form').addEventListener('submit', handleLockSubmit);

    $('lock-pw').addEventListener('input', () => {
      if (!state.setupMode) return;
      const pw = $('lock-pw').value;
      const box = $('lock-strength');
      if (!pw) { box.hidden = true; return; }
      box.hidden = false;
      const bits = passwordBits(pw);
      const label = passwordLabel(bits);
      box.dataset.level = String(label.level);
      $('lock-strength-text').textContent = `${label.text} · 约 ${bits} 位熵`;
    });

    $('btn-lock').addEventListener('click', () => { lock(); toast('已锁定'); });

    $('btn-settings').addEventListener('click', openSettings);

    $('search').addEventListener('input', (e) => {
      state.query = e.target.value;
      renderList();
    });

    $('folders').addEventListener('click', (e) => {
      const chip = e.target.closest('[data-folder]');
      if (!chip) return;
      state.folderFilter = chip.dataset.folder;
      renderList();
    });

    $('f-folder').addEventListener('change', (e) => {
      const isNew = e.target.value === '__new';
      $('folder-new').hidden = !isNew;
      if (isNew) setTimeout(() => $('f-folder-name').focus(), 30);
    });

    $('btn-folder-add').addEventListener('click', createFolderFromInput);

    $('f-folder-name').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); createFolderFromInput(); }
    });

    $('folder-manage').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-fact]');
      if (!btn) return;
      const row = btn.closest('.folder-row');
      const folder = state.folders.find((f) => f.id === row?.dataset.fid);
      if (!folder) return;
      if (btn.dataset.fact === 'rename') startRenameFolder(row, folder);
      if (btn.dataset.fact === 'del') deleteFolder(folder);
    });

    $('btn-new').addEventListener('click', () => openEdit(null));

    $('list').addEventListener('click', (e) => {
      const actionEl = e.target.closest('[data-act]');
      if (actionEl) {
        const id = actionEl.dataset.id;
        const entry = state.entries.find((x) => x.id === id);
        if (!entry) return;
        const act = actionEl.dataset.act;
        if (act === 'copy-user') copyText(entry.username, '账号');
        if (act === 'copy-secret') copyText(entry.secret, '密钥');
        if (act === 'reveal') {
          if (state.revealed.has(id)) state.revealed.delete(id);
          else state.revealed.add(id);
          renderList();
        }
        return;
      }
      const card = e.target.closest('.entry');
      if (card) openEdit(card.dataset.id);
    });

    $('edit-form').addEventListener('submit', saveEdit);
    $('btn-delete').addEventListener('click', deleteEditing);
    $('btn-generate').addEventListener('click', openGen);

    $('btn-reveal-edit').addEventListener('click', () => {
      const box = $('f-secret');
      const masked = box.classList.toggle('is-masked');
      $('btn-reveal-edit').lastChild.textContent = masked ? '显示' : '隐藏';
    });

    $('gen-len').addEventListener('input', syncGenFromInputs);
    ['gen-lower', 'gen-upper', 'gen-digit', 'gen-symbol'].forEach((id) =>
      $(id).addEventListener('change', syncGenFromInputs)
    );
    $('gen-refresh').addEventListener('click', refreshGen);
    $('gen-copy').addEventListener('click', () => copyText($('gen-out').textContent, '新密码'));
    $('gen-use').addEventListener('click', () => {
      $('f-secret').value = $('gen-out').textContent;
      $('f-secret').classList.remove('is-masked');
      $('btn-reveal-edit').lastChild.textContent = '隐藏';
      closeSheet('gen');
    });

    document.querySelectorAll('[data-close]').forEach((btn) => {
      btn.addEventListener('click', () => closeSheet(btn.dataset.close));
    });

    document.querySelectorAll('.sheet').forEach((sheet) => {
      sheet.addEventListener('click', (e) => {
        if (e.target === sheet) closeSheet(sheet.id.replace('sheet-', ''));
      });
    });

    $('s-autolock').addEventListener('change', (e) => {
      state.prefs.autoLock = Number(e.target.value);
      savePrefs();
      armIdleTimer();
      toast(`闲置 ${state.prefs.autoLock} 分钟自动锁定`);
    });

    $('btn-export').addEventListener('click', exportBackup);
    $('btn-import').addEventListener('click', () => $('import-file').click());
    $('import-file').addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      if (f) importBackup(f);
      e.target.value = '';
    });

    $('btn-rekey').addEventListener('click', rekey);
    $('btn-wipe').addEventListener('click', wipe);

    ['pointerdown', 'keydown'].forEach((ev) =>
      document.addEventListener(ev, () => { if (state.key) armIdleTimer(); }, { passive: true })
    );

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        ['edit', 'gen', 'settings'].forEach(closeSheet);
      }
    });
  }

  /* =========================================================
     启动
     ========================================================= */

  function boot() {
    injectIcons();
    loadPrefs();
    state.file = loadFile();
    renderLockMode();
    bind();
    if (state.file) $('lock-pw').focus();

    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
      });
    }
  }

  boot();
})();
