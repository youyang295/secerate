/* =========================================================
   密码箱 · 界面逻辑
   ---------------------------------------------------------
   明文只在内存里：解锁后 entries 在内存，落盘一律先加密。
   ========================================================= */

(() => {
  'use strict';

  /* 改文件时把这里一起改，方便确认手机上跑的是哪一版 */
  const BUILD = 'v5 · 2026-11-07';

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
    folder: SVG('<path d="M3.5 7.5A1.5 1.5 0 015 6h4.2l1.8 2.2H19a1.5 1.5 0 011.5 1.5v7.8A1.5 1.5 0 0119 19H5a1.5 1.5 0 01-1.5-1.5z"/>'),
    upload: SVG('<path d="M12 20V9.5"/><path d="M8 13l4-4 4 4"/><path d="M4.5 5.5h15"/>'),
    share: SVG('<path d="M12 15.5V4.5"/><path d="M8.2 8.3L12 4.5l3.8 3.8"/><path d="M6 12.5v5.2A1.8 1.8 0 007.8 19.5h8.4a1.8 1.8 0 001.8-1.8v-5.2"/>'),
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
  const DEVICE_KEY_STORE = 'vault.device.v1';
  const CLIPBOARD_CLEAR_MS = 30000;

  const uid = () => crypto.randomUUID?.() || String(Date.now() + Math.random());

  const state = {
    file: null,
    key: null,
    entries: [],
    folders: [],
    folderFilter: 'all',
    deviceKey: null,
    prefs: { autoLock: 5 },
    editingId: null,
    revealed: new Set(),
    query: '',
    clipTimer: null,
    busy: false,
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
     打开保险箱（打开即用，不再问主密码）
     ---------------------------------------------------------
     钥匙 = 随机 32 字节，存在本机浏览器里，打开就能解开。
     · 数据在磁盘上仍是密文：随手翻 localStorage 看到的是乱码
     · 代价：谁能打开这台手机 / 这个浏览器，谁就能看到全部内容
     ========================================================= */

  function deviceKey() {
    let k = null;
    try { k = localStorage.getItem(DEVICE_KEY_STORE); } catch { /* 忽略 */ }
    if (k && k.length >= 32) return k;
    k = toB64(randomBytes(32));
    try { localStorage.setItem(DEVICE_KEY_STORE, k); } catch { /* 忽略 */ }
    return k;
  }

  /** 只给升级前的老箱子用：输一次原来的主密码，迁移成本机钥匙 */
  function renderMigrateMode() {
    $('lock-hint').textContent = '输一次原来的主密码';
    $('lock-pw').placeholder = '原来的主密码';
    $('lock-submit').textContent = '继续';
    $('lock-note').textContent = '这是升级前用主密码加密的旧箱子，输对这一次以后就不再问了。';
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
    if (!pw) { lockMessage('先填原来的主密码'); return; }
    await migrateFromPassword(pw);
  }

  async function createVault() {
    const devKey = deviceKey();
    try {
      const fresh = newVaultFile(devKey);
      const { key } = await openVault(fresh, devKey);
      state.file = await sealVault(fresh, key, { entries: [], folders: [] });
      state.key = key;
      state.deviceKey = devKey;
      state.entries = [];
      state.folders = [];
      saveFile();
      enterVault();
      toast('建好了，先存一条试试');
    } catch (err) {
      lockMessage('创建失败：' + (err?.message || err));
      setView('lock');
    }
  }

  /** 用本机钥匙直接打开；打不开返回 false */
  async function openWithDeviceKey() {
    const devKey = deviceKey();
    try {
      const { key, payload } = await openVault(state.file, devKey);
      state.key = key;
      state.deviceKey = devKey;
      state.entries = Array.isArray(payload.entries) ? payload.entries : [];
      state.folders = Array.isArray(payload.folders) ? payload.folders : [];
      enterVault();
      return true;
    } catch {
      return false;
    }
  }

  /** 一次性迁移：老箱子（主密码加密）→ 本机钥匙 */
  async function migrateFromPassword(oldPassword) {
    setLockBusy(true, '处理中…');
    try {
      const { payload } = await openVault(state.file, oldPassword);
      const devKey = deviceKey();
      const newFile = await rekeyVault(state.file, payload, devKey);
      const opened = await openVault(newFile, devKey);
      state.file = newFile;
      state.key = opened.key;
      state.deviceKey = devKey;
      state.entries = Array.isArray(payload.entries) ? payload.entries : [];
      state.folders = Array.isArray(payload.folders) ? payload.folders : [];
      saveFile();
      $('lock-pw').value = '';
      lockMessage('');
      enterVault();
      toast('好了，以后打开就直接进来');
    } catch (err) {
      lockMessage(err?.name === 'OperationError' ? '主密码不对，再试一次' : '打不开：' + (err?.message || err));
      $('lock-pw').value = '';
      $('lock-pw').focus?.();
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
      ? `${state.entries.length} 条`
      : '还没有东西';

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
    renderFolderSettings();
    renderBackupState();
    openSheet('settings');
  }

  /* ---------------- 备份 ---------------- */

  /* 浏览器安全限制：网页不能打开「文件管理器」或跳转到本地文件夹。
     能做的是——在电脑浏览器上选一次文件夹（File System Access API），
     把句柄记下来，之后点一下就直接把文件写进那个文件夹，不再弹保存框。 */
  const canPickDir = typeof window.showDirectoryPicker === 'function';
  let backupDirHandle = null;

  function backupFileName() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `密码箱备份-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
  }

  function backupJSON() {
    return JSON.stringify({ ...state.file, deviceKey: state.deviceKey || deviceKey() }, null, 2);
  }

  function openIdb() {
    return new Promise((res, rej) => {
      const req = indexedDB.open('vault-fs', 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('handles')) req.result.createObjectStore('handles');
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }

  function idbGet(k) {
    return openIdb().then((db) => new Promise((res, rej) => {
      const req = db.transaction('handles', 'readonly').objectStore('handles').get(k);
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => rej(req.error);
    }));
  }

  function idbSet(k, v) {
    return openIdb().then((db) => new Promise((res, rej) => {
      const tx = db.transaction('handles', 'readwrite');
      tx.objectStore('handles').put(v, k);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    }));
  }

  async function loadBackupDir() {
    if (!canPickDir) return;
    try {
      backupDirHandle = await idbGet('backupDir');
    } catch {
      backupDirHandle = null;
    }
    renderBackupState();
  }

  function daysSince(ts) {
    if (!ts) return null;
    return Math.floor((Date.now() - ts) / 86400000);
  }

  function renderBackupState() {
    const stateEl = $('backup-state');
    if (!stateEl) return;
    const dirBox = $('backup-dir');
    const dirName = $('backup-dir-name');
    const hint = $('backup-hint');

    const d = daysSince(state.prefs.lastBackupAt);
    if (d === null) stateEl.textContent = '还没备份过';
    else if (d === 0) stateEl.textContent = '上次备份：今天';
    else stateEl.textContent = `上次备份：${d} 天前`;
    stateEl.classList.toggle('is-stale', d === null || d >= 14);

    if (dirBox) dirBox.hidden = !canPickDir;
    if (dirName) dirName.textContent = backupDirHandle ? backupDirHandle.name : '还没选文件夹';

    const shareBtn = $('btn-share');
    if (shareBtn) shareBtn.hidden = false;
    const tag = $('build-tag');
    if (tag) tag.textContent = BUILD;

    if (hint) {
      hint.textContent = canPickDir
        ? '选一次文件夹，以后点「存进这个文件夹」就直接写进去，不再弹保存框。备份里带着本机钥匙，谁拿到谁能读。'
        : '手机上点「存到手机…」会弹系统面板，选「保存到文件」就能自己挑位置；点「导出备份」是直接下载，安卓浏览器常把它塞进自己的下载目录，事后不好找。都找不到就用「复制备份内容」。';
    }
  }

  async function chooseBackupDir() {
    if (!canPickDir) { toast('这个浏览器不支持选文件夹'); return; }
    try {
      const h = await window.showDirectoryPicker({ id: 'vault-backup', mode: 'readwrite', startIn: 'documents' });
      const perm = await h.requestPermission({ mode: 'readwrite' });
      if (perm !== 'granted') { toast('没给写入权限，再选一次'); return; }
      backupDirHandle = h;
      await idbSet('backupDir', h);
      renderBackupState();
      toast(`备份文件夹：${h.name}`);
    } catch (e) {
      if (e?.name !== 'AbortError') toast('没能选这个文件夹');
    }
  }

  async function saveIntoDir() {
    const h = backupDirHandle;
    if (!h) { toast('先选一个文件夹'); return; }
    try {
      let perm = await h.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') perm = await h.requestPermission({ mode: 'readwrite' });
      if (perm !== 'granted') { toast('没有写入权限，重新选一下文件夹'); return; }
      const name = backupFileName();
      const fh = await h.getFileHandle(name, { create: true });
      const w = await fh.createWritable();
      await w.write(backupJSON());
      await w.close();
      markBackedUp();
      toast(`已存进「${h.name}」`);
    } catch (e) {
      toast('写入失败：' + (e?.message || e));
    }
  }

  function markBackedUp() {
    state.prefs.lastBackupAt = Date.now();
    savePrefs();
    renderBackupState();
  }

  function exportBackup() {
    const blob = new Blob([backupJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = backupFileName();
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    markBackedUp();
    toast(`已导出 ${backupFileName()}；找不到就用「存到手机…」`);
  }

  /* 「存到手机…」：走系统分享面板。手机上比直接下载可靠得多，
     因为浏览器下载会悄悄扔进它自己的目录，事后很难找。 */
  function canShareFile(file) {
    try {
      return !!(navigator.canShare && navigator.share && navigator.canShare({ files: [file] }));
    } catch {
      return false;
    }
  }

  function makeBackupFile() {
    return new File([backupJSON()], backupFileName(), { type: 'application/json' });
  }

  async function shareBackup() {
    const file = makeBackupFile();
    if (!canShareFile(file)) {
      /* 很多国产手机浏览器没有「分享文件」能力，别让按钮点了没反应 */
      copyBackup();
      return;
    }
    try {
      await navigator.share({ files: [file], title: backupFileName() });
      markBackedUp();
      toast('已保存');
    } catch (e) {
      if (e?.name === 'AbortError') return;
      copyBackup();
    }
  }

  /* 最后的保底：内容进剪贴板，粘到备忘录 / 微信「文件传输助手」都能存 */
  async function copyBackup() {
    const text = backupJSON();
    try {
      await navigator.clipboard.writeText(text);
      markBackedUp();
      toast('备份内容已复制，粘到备忘录或文件传输助手里就行');
      return;
    } catch {
      /* 继续走老办法 */
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    if (ok) {
      markBackedUp();
      toast('备份内容已复制，粘到备忘录里就行');
    } else {
      /* 连 execCommand 都不行（有些手机浏览器会拦）：直接把内容摊开让人长按选 */
      showBackupText(text);
    }
  }

  function showBackupText(text) {
    const box = $('backup-text');
    if (!box) {
      toast('浏览器不让复制，请换一个浏览器试试');
      return;
    }
    box.value = text;
    openSheet('backup-text');
    markBackedUp();
    setTimeout(() => {
      try { box.focus(); box.select(); } catch { /* 忽略 */ }
    }, 60);
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

    /* 新式备份：文件里自带钥匙，直接开 */
    if (typeof parsed.deviceKey === 'string' && parsed.deviceKey.length >= 32) {
      const { deviceKey: dk, ...rest } = parsed;
      state.file = rest;
      state.key = null;
      state.entries = [];
      state.deviceKey = dk;
      try { localStorage.setItem(DEVICE_KEY_STORE, dk); } catch { /* 忽略 */ }
      saveFile();
      closeSheet('settings');
      const ok = await openWithDeviceKey();
      toast(ok ? '导入成功' : '导入的文件打不开');
      return;
    }

    /* 老式备份：用主密码加密的，输一次它的主密码迁移 */
    state.file = parsed;
    state.key = null;
    state.entries = [];
    saveFile();
    closeSheet('settings');
    renderMigrateMode();
    setView('lock');
    lockMessage('这是旧备份，输一次它的主密码');
    $('lock-pw').value = '';
    $('lock-pw').focus?.();
  }

  function wipe() {
    if (!confirm('清空本地所有数据？没有备份就真的没了。')) return;
    if (!confirm('再确认一次：现在清空？')) return;
    localStorage.removeItem(STORE_KEY);
    localStorage.removeItem(PREFS_KEY);
    localStorage.removeItem(DEVICE_KEY_STORE);
    location.reload();
  }

  /* =========================================================
     事件绑定
     ========================================================= */

  function bind() {
    $('lock-form').addEventListener('submit', handleLockSubmit);

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

    $('btn-export').addEventListener('click', exportBackup);    $('btn-pick-dir').addEventListener('click', chooseBackupDir);
    $('btn-save-dir').addEventListener('click', saveIntoDir);
    $('btn-import').addEventListener('click', () => $('import-file').click());
    $('import-file').addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      if (f) importBackup(f);
      e.target.value = '';
    });

    $('btn-share').addEventListener('click', shareBackup);
    $('btn-copy-backup').addEventListener('click', copyBackup);
    $('btn-backup-text-select').addEventListener('click', () => {
      const ta = $('backup-text');
      if (!ta) return;
      ta.focus();
      ta.select();
    });

    $('btn-wipe').addEventListener('click', wipe);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        ['edit', 'gen', 'settings'].forEach(closeSheet);
      }
    });
  }

  /* =========================================================
     启动
     ========================================================= */

  async function boot() {
    injectIcons();
    loadPrefs();
    bind();
    loadBackupDir();

    state.file = loadFile();

    if (!state.file) {
      await createVault();
    } else if (!(await openWithDeviceKey())) {
      /* 只有升级前用主密码加密的老箱子才走到这里 */
      renderMigrateMode();
      setView('lock');
      lockMessage('');
      $('lock-pw').value = '';
      setTimeout(() => $('lock-pw').focus?.(), 60);
    }

    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
      });
    }
  }

  boot();
})();
