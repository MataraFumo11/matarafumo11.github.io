/* =========================================================
   东方简历 · 地灵殿 — 核心逻辑
   纯静态 / 无依赖 / 数据存 localStorage + URL hash 快照
   ========================================================= */
(function () {
  'use strict';

  var KEY = 'resume.data.v1';
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  var ICONS = ['mail', 'phone', 'github', 'qq', 'book', 'note', 'rose', 'eye', 'flame', 'star', 'link'];

  /* ---------- 默认数据（已脱敏，可直接在编辑面板里改） ---------- */
  var DEFAULTS = {
    schema: 1,
    settings: { editEntryVisible: false, baseUrl: '' },
    profile: {
      visible: true,
      avatar: 'avatar.jpg',
      name: '古明地 觉',
      title: '地灵殿 · 一年级新人',
      school: '○○大学 计算机学院',
      grade: '2026 级 · 大一',
      bio: '喜欢观察、记录，也喜欢把脑海里的幻想做成能点开的页面。正在认真学习 HTML、CSS 与 Python，期待加入实验室，一起折腾有趣的东西。',
      motto: '所见即所思，所思即所言。'
    },
    contact: {
      visible: true,
      items: [
        { id: 'c1', visible: true, icon: 'mail', label: '学校邮箱', value: 'yourname@school.edu.cn', href: 'mailto:yourname@school.edu.cn' },
        { id: 'c2', visible: true, icon: 'phone', label: '联系电话', value: '138-0000-0000', href: 'tel:13800000000' },
        { id: 'c3', visible: false, icon: 'qq', label: 'QQ', value: '（按需填写）', href: '' }
      ]
    },
    skills: {
      visible: true,
      items: [
        { id: 's1', visible: true, name: 'HTML / CSS', level: 72, rank: 3, desc: '能独立写出响应式静态页面' },
        { id: 's2', visible: true, name: 'Python', level: 62, rank: 3, desc: '课程项目与简单脚本' },
        { id: 's3', visible: true, name: 'JavaScript', level: 45, rank: 2, desc: '基础 DOM 操作与事件处理' },
        { id: 's4', visible: false, name: 'C 语言', level: 38, rank: 1, desc: '正在学习中' }
      ]
    },
    interests: {
      visible: true,
      items: [
        { id: 'i1', visible: true, name: '东方 Project', icon: 'star', desc: '原曲与角色设定' },
        { id: 'i2', visible: true, name: '插画临摹', icon: 'rose', desc: '线稿与速写练习' },
        { id: 'i3', visible: true, name: '阅读', icon: 'book', desc: '幻想乡设定集' }
      ]
    },
    works: {
      visible: true,
      items: [
        { id: 'w1', visible: true, title: '个人简历网站', desc: '零依赖静态单页，自带可视化编辑面板与分享二维码。', tags: ['HTML', 'CSS', 'JavaScript'], link: '', image: '' },
        { id: 'w2', visible: true, title: '课程小项目', desc: '用 Python 做的数据整理脚本，锻炼了基础编程思维。', tags: ['Python'], link: '', image: '' }
      ]
    }
  };

  var state = {
    data: null,
    draft: null,
    mode: 'owner',
    suppressHash: false,
    shareUrl: '',
    qrDataUrl: ''
  };

  /* ---------- 工具函数 ---------- */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function uid() { return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function safeUrl(u) {
    u = String(u == null ? '' : u).trim();
    return /^(https?:\/\/|mailto:|tel:)/i.test(u) ? u : '';
  }
  function safeImage(u) {
    u = String(u == null ? '' : u).trim();
    if (/^data:image\//i.test(u)) return u;
    if (/^https?:\/\//i.test(u)) return u;
    // 允许项目内的相对图片文件，例如 avatar.png（发布后访客也能从站点加载）
    if (/^\.?\/?[\w\-.\/]+\.(png|jpe?g|webp|gif|svg)$/i.test(u) && u.indexOf('..') < 0) return u;
    return '';
  }
  function safeIcon(i, fallback) {
    return ICONS.indexOf(i) >= 0 ? i : (fallback || 'rose');
  }
  function getPath(obj, path) {
    return path.split('.').reduce(function (o, k) { return o && o[k]; }, obj);
  }
  function setPath(obj, path, val) {
    var ps = path.split('.'), o = obj;
    for (var i = 0; i < ps.length - 1; i++) { o = o[ps[i]]; if (!o) return; }
    o[ps[ps.length - 1]] = val;
  }
  function clamp(n, min, max) {
    n = Number(n); return isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
  }
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 2800);
  }

  /* ---------- 数据规范化 ---------- */
  function normalize(raw) {
    var d = clone(DEFAULTS);
    if (!raw || typeof raw !== 'object') return d;
    if (raw.settings) {
      d.settings.editEntryVisible = !!raw.settings.editEntryVisible;
      d.settings.baseUrl = String(raw.settings.baseUrl || '').slice(0, 200);
    }
    if (raw.profile) {
      ['name', 'title', 'school', 'grade', 'bio', 'motto', 'avatar'].forEach(function (k) {
        if (typeof raw.profile[k] === 'string') d.profile[k] = raw.profile[k].slice(0, k === 'bio' ? 500 : 200);
      });
      if (typeof raw.profile.visible === 'boolean') d.profile.visible = raw.profile.visible;
      d.profile.avatar = safeImage(d.profile.avatar);
    }
    ['contact', 'skills', 'interests', 'works'].forEach(function (sec) {
      if (!raw[sec]) return;
      if (typeof raw[sec].visible === 'boolean') d[sec].visible = raw[sec].visible;
      if (!Array.isArray(raw[sec].items)) return;
      d[sec].items = raw[sec].items.slice(0, 40).map(function (it) {
        if (!it || typeof it !== 'object') return null;
        var base = { id: String(it.id || uid()), visible: it.visible !== false };
        if (sec === 'contact') {
          base.icon = safeIcon(it.icon, 'mail');
          base.label = String(it.label || '').slice(0, 40);
          base.value = String(it.value || '').slice(0, 120);
          base.href = safeUrl(it.href);
        } else if (sec === 'skills') {
          base.name = String(it.name || '').slice(0, 60);
          base.level = clamp(it.level, 0, 100);
          base.rank = clamp(it.rank, 1, 5);
          base.desc = String(it.desc || '').slice(0, 160);
        } else if (sec === 'interests') {
          base.name = String(it.name || '').slice(0, 60);
          base.icon = safeIcon(it.icon, 'rose');
          base.desc = String(it.desc || '').slice(0, 160);
        } else {
          base.title = String(it.title || '').slice(0, 80);
          base.desc = String(it.desc || '').slice(0, 300);
          base.tags = Array.isArray(it.tags) ? it.tags.slice(0, 8).map(function (t) { return String(t).slice(0, 20); }) : [];
          base.link = safeUrl(it.link);
          base.image = safeImage(it.image);
        }
        return base;
      }).filter(Boolean);
    });
    // 兼容此前已保存在浏览器里的旧数据：把示例 GitHub 条目升级为联系电话
    if (d.contact && Array.isArray(d.contact.items)) {
      d.contact.items.forEach(function (it) {
        if (it.id === 'c2' && it.value === 'github.com/yourname') {
          it.icon = 'phone'; it.label = '联系电话';
          it.value = '138-0000-0000'; it.href = 'tel:13800000000';
        }
      });
    }
    return d;
  }

  /* ---------- 本地存储 ---------- */
  function loadLocal() {
    try {
      var s = localStorage.getItem(KEY);
      return s ? normalize(JSON.parse(s)) : null;
    } catch (e) { return null; }
  }
  function saveLocal(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); return true; }
    catch (e) { toast('浏览器存储不可用：你的改动只在当前页面有效，请用分享链接发送'); return false; }
  }

  /* ---------- 编解码（UTF-8 安全的 base64url） ---------- */
  function bytesToBase64url(bytes) {
    var bin = '', CHUNK = 0x8000;
    for (var i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function base64urlToBytes(s) {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function compactForShare(d) {
    var o = clone(d), self = this;
    delete o.settings;
    if (!o.profile || !o.profile.visible) delete o.profile;
    else {
      Object.keys(o.profile).forEach(function (k) {
        if (k !== 'visible' && (o.profile[k] === '' || o.profile[k] == null)) delete o.profile[k];
      });
      if (o.profile.avatar && o.profile.avatar.length > 20000) delete o.profile.avatar;
    }
    ['contact', 'skills', 'interests', 'works'].forEach(function (sec) {
      if (!o[sec] || !o[sec].visible) { delete o[sec]; return; }
      o[sec].items = o[sec].items.filter(function (it) { return it.visible !== false; }).map(function (it) {
        var n = {};
        Object.keys(it).forEach(function (k) {
          if (k === 'visible' || k === 'id') return;
          if (it[k] === '' || it[k] == null || (Array.isArray(it[k]) && !it[k].length)) return;
          n[k] = it[k];
        });
        return n;
      });
      if (!o[sec].items.length) delete o[sec];
    });
    return o;
  }
  function encodeData(d) {
    return bytesToBase64url(new TextEncoder().encode(JSON.stringify(compactForShare(d))));
  }
  function decodeData(code) {
    return JSON.parse(new TextDecoder().decode(base64urlToBytes(code)));
  }

  /* ---------- 渲染 ---------- */
  function renderAvatar() {
    var box = $('#avatar-frame');
    var av = state.data.profile.avatar;
    if (av) {
      box.innerHTML = '<img src="' + esc(av) + '" alt="头像">';
    } else {
      box.innerHTML = '<svg class="ic avatar-default"><use href="#i-default-avatar"></use></svg>';
    }
  }
  function renderProfile() {
    var p = state.data.profile;
    $('#sec-profile').hidden = !p.visible;
    $('#p-name').textContent = p.name;
    $('#p-title').textContent = p.title;
    $('#p-school').textContent = p.school;
    $('#p-grade').textContent = p.grade;
    $('#p-bio').textContent = p.bio;
    $('#p-motto').textContent = p.motto ? '「' + p.motto + '」' : '';
    renderAvatar();
  }
  function renderContact() {
    var sec = state.data.contact, box = $('#contact-grid');
    $('#sec-contact').hidden = !sec.visible;
    var items = sec.items.filter(function (i) { return i.visible !== false; });
    if (!items.length) { box.innerHTML = '<div class="empty">暂无联系方式</div>'; return; }
    box.innerHTML = items.map(function (it) {
      var inner = '<span class="chip-ic"><svg class="ic"><use href="#i-' + safeIcon(it.icon, 'mail') + '"></use></svg></span>' +
        '<span><small>' + esc(it.label) + '</small><span>' + esc(it.value) + '</span></span>';
      var href = safeUrl(it.href);
      return href
        ? '<a class="contact-chip" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + inner + '</a>'
        : '<div class="contact-chip">' + inner + '</div>';
    }).join('');
  }
  function renderSkills() {
    var sec = state.data.skills, box = $('#skill-grid');
    $('#sec-skills').hidden = !sec.visible;
    var items = sec.items.filter(function (i) { return i.visible !== false; });
    if (!items.length) { box.innerHTML = '<div class="empty">暂无技能符卡</div>'; return; }
    box.innerHTML = items.map(function (it) {
      var rank = clamp(it.rank, 1, 5), stars = '';
      for (var i = 1; i <= 5; i++) stars += '<svg class="ic' + (i > rank ? ' off' : '') + '"><use href="#i-star"></use></svg>';
      return '<article class="skill-card"><div class="skill-ring" style="--v:' + clamp(it.level, 0, 100) + '"><span>' + clamp(it.level, 0, 100) + '</span></div>' +
        '<div class="skill-info"><h3>' + esc(it.name) + '</h3><div class="skill-rank">' + stars + '</div><p>' + esc(it.desc) + '</p></div></article>';
    }).join('');
  }
  function renderInterests() {
    var sec = state.data.interests, box = $('#ofuda-grid');
    $('#sec-interests').hidden = !sec.visible;
    var items = sec.items.filter(function (i) { return i.visible !== false; });
    if (!items.length) { box.innerHTML = '<div class="empty">暂无兴趣御札</div>'; return; }
    box.innerHTML = items.map(function (it) {
      return '<article class="ofuda"><span class="stamp">印</span><div class="ofuda-ic"><svg class="ic"><use href="#i-' + safeIcon(it.icon, 'rose') + '"></use></svg></div>' +
        '<h3>' + esc(it.name) + '</h3><p>' + esc(it.desc) + '</p></article>';
    }).join('');
  }
  function renderWorks() {
    var sec = state.data.works, box = $('#work-grid');
    $('#sec-works').hidden = !sec.visible;
    var items = sec.items.filter(function (i) { return i.visible !== false; });
    if (!items.length) { box.innerHTML = '<div class="empty">暂无作品展示</div>'; return; }
    box.innerHTML = items.map(function (it) {
      var img = safeImage(it.image);
      var thumb = img ? '<img src="' + esc(img) + '" alt="作品缩略图">' : '<svg class="ic"><use href="#i-rose"></use></svg>';
      var tags = (it.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('');
      var link = safeUrl(it.link);
      return '<article class="work-card"><div class="work-thumb">' + thumb + '</div><div class="work-body">' +
        '<h3>' + esc(it.title) + '</h3><p>' + esc(it.desc) + '</p><div class="work-tags">' + tags + '</div>' +
        (link ? '<a class="work-link" href="' + esc(link) + '" target="_blank" rel="noopener noreferrer"><svg class="ic"><use href="#i-link"></use></svg>查看链接</a>' : '') +
        '</div></article>';
    }).join('');
  }
  function render() {
    renderProfile(); renderContact(); renderSkills(); renderInterests(); renderWorks();
    $('#gear-btn').hidden = !state.data.settings.editEntryVisible;
    $('#footer-hint').hidden = state.mode === 'guest';
  }

  /* ---------- 编辑抽屉 ---------- */
  var LIST_FIELDS = {
    contact: [
      { k: 'label', l: '名称', t: 'text' }, { k: 'value', l: '显示内容', t: 'text' },
      { k: 'icon', l: '图标', t: 'icon' }, { k: 'href', l: '链接（留空则只展示文字）', t: 'text' }
    ],
    skills: [
      { k: 'name', l: '技能名', t: 'text' }, { k: 'level', l: '熟练度 0-100', t: 'number' },
      { k: 'rank', l: '星级 1-5', t: 'number' }, { k: 'desc', l: '说明', t: 'text' }
    ],
    interests: [
      { k: 'name', l: '兴趣名', t: 'text' }, { k: 'icon', l: '图标', t: 'icon' }, { k: 'desc', l: '说明', t: 'text' }
    ],
    works: [
      { k: 'title', l: '作品名', t: 'text' }, { k: 'desc', l: '简介', t: 'textarea' },
      { k: 'tags', l: '标签（用逗号分隔）', t: 'tags' }, { k: 'link', l: '链接', t: 'text' }, { k: 'image', l: '图片地址（可留空）', t: 'text' }
    ]
  };
  function fieldHtml(f, val) {
    var id = 'f-' + uid();
    var label = '<label for="' + id + '">' + esc(f.l) + '</label>';
    var input;
    if (f.t === 'icon') {
      input = '<select id="' + id + '" data-field="' + f.k + '">' + ICONS.map(function (ic) {
        return '<option value="' + ic + '"' + (ic === val ? ' selected' : '') + '>' + ic + '</option>';
      }).join('') + '</select>';
    } else if (f.t === 'textarea') {
      input = '<textarea id="' + id + '" data-field="' + f.k + '" rows="3">' + esc(val) + '</textarea>';
    } else {
      var v = f.t === 'tags' ? (val || []).join(', ') : val;
      var type = f.t === 'number' ? 'number' : 'text';
      input = '<input id="' + id + '" type="' + type + '" data-field="' + f.k + '" value="' + esc(v) + '">';
    }
    return '<div class="field">' + label + input + '</div>';
  }
  function itemTitle(sec, it) {
    if (sec === 'works') return it.title || '未命名作品';
    if (sec === 'skills') return it.name || '未命名技能';
    return it.name || it.label || '未命名条目';
  }
  function renderListEditor(sec) {
    var box = $('.list-editor[data-list="' + sec + '"]');
    var items = state.draft[sec].items;
    if (!items.length) { box.innerHTML = '<div class="empty">还没有条目，点下方按钮添加</div>'; return; }
    box.innerHTML = items.map(function (it, idx) {
      var fields = LIST_FIELDS[sec].map(function (f) { return fieldHtml(f, it[f.k]); }).join('');
      return '<div class="edit-item" data-id="' + esc(it.id) + '">' +
        '<div class="edit-item-head">' +
        '<button type="button" class="mini-icon eye ' + (it.visible === false ? 'off' : '') + '" data-act="toggle" aria-label="显示/隐藏">' +
        '<svg class="ic"><use href="#i-hidden"></use></svg></button>' +
        '<button type="button" class="title" data-act="expand">' + esc(itemTitle(sec, it)) + ' ' + (it.visible === false ? '（已隐藏）' : '') + '</button>' +
        '<button type="button" class="mini-icon" data-act="up" aria-label="上移"><svg class="ic"><use href="#i-up"></use></svg></button>' +
        '<button type="button" class="mini-icon" data-act="down" aria-label="下移"><svg class="ic"><use href="#i-down"></use></svg></button>' +
        '<button type="button" class="mini-icon del" data-act="del" aria-label="删除"><svg class="ic"><use href="#i-trash"></use></svg></button>' +
        '</div><div class="edit-item-body">' + fields + '</div></div>';
    }).join('');
  }
  function renderAllListEditors() {
    ['contact', 'skills', 'interests', 'works'].forEach(renderListEditor);
  }
  function fillBasic() {
    $$('[data-path]').forEach(function (el) {
      var v = getPath(state.draft, el.getAttribute('data-path'));
      if (el.type === 'checkbox') el.checked = !!v;
      else el.value = v == null ? '' : v;
    });
    $('#base-url').value = state.draft.settings.baseUrl || '';
    var av = state.draft.profile.avatar;
    $('#avatar-preview').innerHTML = av
      ? '<img src="' + esc(av) + '" alt="头像预览">'
      : '<svg class="ic"><use href="#i-default-avatar"></use></svg>';
  }
  function openEditor() {
    if (state.mode === 'guest') { toast('这是分享快照；请先点顶部「返回我的版本」再编辑'); return; }
    state.draft = clone(state.data);
    fillBasic(); renderAllListEditors();
    $('#drawer').hidden = false; $('#drawer-overlay').hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeEditor() {
    $('#drawer').hidden = true; $('#drawer-overlay').hidden = true;
    document.body.style.overflow = '';
    state.draft = null;
  }
  function saveEditor() {
    if (!state.draft) return;
    state.draft.settings.baseUrl = $('#base-url').value.trim().slice(0, 200);
    state.data = normalize(state.draft);
    saveLocal(state.data);
    render(); closeEditor(); toast('已保存，刷新页面后依然有效');
  }
  function findItem(sec, id) {
    return state.draft[sec].items.filter(function (it) { return it.id === id; })[0];
  }

  /* ---------- 事件绑定 ---------- */
  function bindEditor() {
    $('#drawer-close').addEventListener('click', closeEditor);
    $('#drawer-cancel').addEventListener('click', closeEditor);
    $('#drawer-save').addEventListener('click', saveEditor);
    $('#drawer-overlay').addEventListener('click', closeEditor);
    $('#gear-btn').addEventListener('click', openEditor);
    $('#footer-hint').addEventListener('click', openEditor);

    $$('.tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        $$('.tab').forEach(function (b) { b.classList.toggle('active', b === btn); });
        $$('.tab-panel').forEach(function (p) { p.classList.toggle('active', p.getAttribute('data-panel') === btn.getAttribute('data-tab')); });
      });
    });

    $('#drawer').addEventListener('change', function (e) {
      var el = e.target;
      if (el.matches('[data-path]')) {
        var v = el.type === 'checkbox' ? el.checked : el.value;
        setPath(state.draft, el.getAttribute('data-path'), v);
        if (el.getAttribute('data-path') === 'profile.visible') render();
      }
    });
    $('#drawer').addEventListener('input', function (e) {
      var el = e.target;
      if (el.matches('[data-path]') && el.type !== 'checkbox') {
        setPath(state.draft, el.getAttribute('data-path'), el.value);
      }
      if (el.matches('[data-field]')) {
        var wrap = el.closest('.edit-item'), secEl = el.closest('.list-editor');
        if (!wrap || !secEl) return;
        var sec = secEl.getAttribute('data-list'), it = findItem(sec, wrap.getAttribute('data-id'));
        if (!it) return;
        var k = el.getAttribute('data-field');
        if (k === 'tags') it.tags = el.value.split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 8);
        else if (k === 'level' || k === 'rank') it[k] = clamp(el.value, k === 'rank' ? 1 : 0, k === 'rank' ? 5 : 100);
        else it[k] = el.value;
      }
    });

    $$('.list-editor').forEach(function (box) {
      box.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-act]');
        if (!btn) return;
        var sec = box.getAttribute('data-list');
        var row = btn.closest('.edit-item'), id = row.getAttribute('data-id');
        var arr = state.draft[sec].items, idx = arr.map(function (x) { return x.id; }).indexOf(id);
        if (idx < 0) return;
        var act = btn.getAttribute('data-act');
        if (act === 'toggle') { arr[idx].visible = arr[idx].visible === false; renderListEditor(sec); }
        else if (act === 'expand') { row.classList.toggle('open'); }
        else if (act === 'del') { arr.splice(idx, 1); renderListEditor(sec); }
        else if (act === 'up' && idx > 0) { arr.splice(idx - 1, 0, arr.splice(idx, 1)[0]); renderListEditor(sec); }
        else if (act === 'down' && idx < arr.length - 1) { arr.splice(idx + 1, 0, arr.splice(idx, 1)[0]); renderListEditor(sec); }
      });
    });
    $$('[data-add]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sec = btn.getAttribute('data-add');
        var it = { id: uid(), visible: true };
        if (sec === 'contact') { it.icon = 'mail'; it.label = '新联系方式'; it.value = ''; it.href = ''; }
        if (sec === 'skills') { it.name = '新技能'; it.level = 50; it.rank = 3; it.desc = ''; }
        if (sec === 'interests') { it.name = '新兴趣'; it.icon = 'rose'; it.desc = ''; }
        if (sec === 'works') { it.title = '新作品'; it.desc = ''; it.tags = []; it.link = ''; it.image = ''; }
        state.draft[sec].items.push(it); renderListEditor(sec);
        var rows = $$('.list-editor[data-list="' + sec + '"] .edit-item');
        if (rows.length) rows[rows.length - 1].classList.add('open');
      });
    });

    function handleAvatarFile(file) {
      if (!file || !/^image\//.test(file.type)) { toast('请选择图片文件（PNG / JPG / WEBP）'); return; }
      if (file.size > 5 * 1024 * 1024) { toast('图片请小于 5MB'); return; }
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var size = 192, canvas = document.createElement('canvas');
          canvas.width = canvas.height = size;
          var ctx = canvas.getContext('2d');
          // 先铺一层与头像框一致的深玫瑰底色，避免透明 PNG 转成黑底
          var g = ctx.createRadialGradient(size * 0.36, size * 0.3, 8, size / 2, size / 2, size * 0.72);
          g.addColorStop(0, '#5e2740'); g.addColorStop(1, '#1b0d1c');
          ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
          // 居中裁成正方形，圆形显示由外层头像框完成
          var side = Math.min(img.width, img.height);
          ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
          state.draft.profile.avatar = canvas.toDataURL('image/jpeg', 0.76);
          $('#avatar-preview').innerHTML = '<img src="' + state.draft.profile.avatar + '" alt="头像预览">';
          toast('头像已就绪，点击保存后生效');
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    }
    $('#avatar-input').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (file) handleAvatarFile(file);
    });
    // 也可以直接把 PNG 拖到头像预览框里
    var avatarBox = $('#avatar-preview');
    avatarBox.addEventListener('click', function () { $('#avatar-input').click(); });
    avatarBox.addEventListener('dragover', function (e) { e.preventDefault(); avatarBox.style.borderColor = 'var(--rose-2)'; });
    avatarBox.addEventListener('dragleave', function () { avatarBox.style.borderColor = ''; });
    avatarBox.addEventListener('drop', function (e) {
      e.preventDefault(); avatarBox.style.borderColor = '';
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) handleAvatarFile(file);
    });
    $('#avatar-clear').addEventListener('click', function () {
      state.draft.profile.avatar = '';
      $('#avatar-preview').innerHTML = '<svg class="ic"><use href="#i-default-avatar"></use></svg>';
      toast('已清除，保存后使用内置头像');
    });

    $('#make-link').addEventListener('click', makeLink);
    $('#copy-link').addEventListener('click', copyLink);
    $('#make-qr').addEventListener('click', makeQR);
    $('#download-qr').addEventListener('click', downloadQR);
    $('#export-json').addEventListener('click', function () {
      $('#json-io').value = JSON.stringify(state.draft, null, 2);
      toast('已导出到文本框，请复制保存');
    });
    $('#import-json').addEventListener('click', function () {
      try {
        var obj = JSON.parse($('#json-io').value);
        state.draft = normalize(obj); fillBasic(); renderAllListEditors();
        toast('导入成功，记得点保存');
      } catch (err) { toast('JSON 格式不对，请检查后重试'); }
    });
    $('#reset-default').addEventListener('click', function () {
      if (!confirm('确定要恢复示例默认内容吗？你当前的编辑将被覆盖。')) return;
      state.draft = clone(DEFAULTS); fillBasic(); renderAllListEditors();
      toast('已恢复默认，点保存后生效');
    });
  }

  /* ---------- 分享链接与二维码 ---------- */
  function buildBase() {
    var b = ($('#base-url') && $('#base-url').value.trim()) || state.data.settings.baseUrl || location.href.split('#')[0];
    return b.replace(/#.*$/, '');
  }
  function makeLink() {
    try {
      var code = encodeData(state.draft || state.data);
      var url = buildBase() + (buildBase().indexOf('#') >= 0 ? '&' : '#') + 'd=' + code;
      state.shareUrl = url;
      $('#share-link').value = url;
      var warn = $('#link-warning');
      if (url.length > 1500) {
        warn.hidden = false;
        warn.textContent = '链接较长（' + url.length + ' 字符），部分扫码工具可能识别困难。建议精简文字、使用小头像，或发布后填入站点基础地址。';
      } else { warn.hidden = true; }
      toast('分享链接已生成');
    } catch (e) { toast('生成失败：' + e.message); }
  }
  function copyLink() {
    var text = $('#share-link').value;
    if (!text) { toast('请先生成分享链接'); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast('链接已复制'); }, fallback);
    } else fallback();
    function fallback() {
      var ta = $('#share-link'); ta.removeAttribute('readonly'); ta.select();
      try { document.execCommand('copy'); toast('链接已复制'); }
      catch (e) { toast('复制失败，请手动选中文本框内容复制'); }
      ta.setAttribute('readonly', '');
    }
  }
  function makeQR() {
    var url = $('#share-link').value || state.shareUrl;
    if (!url) { makeLink(); url = $('#share-link').value; }
    if (!url || typeof qrcode === 'undefined') { toast('二维码组件未加载'); return; }
    try {
      qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
      var qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      var n = qr.getModuleCount(), cell = 8, margin = 4;
      var canvas = document.createElement('canvas');
      canvas.width = canvas.height = (n + margin * 2) * cell;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#1a0812';
      for (var r = 0; r < n; r++) {
        for (var c = 0; c < n; c++) {
          if (qr.isDark(r, c)) ctx.fillRect((c + margin) * cell, (r + margin) * cell, cell, cell);
        }
      }
      state.qrDataUrl = canvas.toDataURL('image/png');
      $('#qr-img').src = state.qrDataUrl; $('#qr-img').hidden = false; $('#qr-placeholder').hidden = true;
      toast('二维码已生成');
    } catch (e) { toast('二维码生成失败，链接可能过长'); }
  }
  function downloadQR() {
    if (!state.qrDataUrl) { toast('请先生成二维码'); return; }
    try {
      var a = document.createElement('a');
      a.href = state.qrDataUrl; a.download = 'resume-qr.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      toast('已开始下载；如未下载请右键图片另存为');
    } catch (e) { toast('请右键二维码图片选择「另存为」'); }
  }

  /* ---------- 启动 ---------- */
  function bindGlobal() {
    var pressTimer = null;
    function startPress() { clearTimeout(pressTimer); pressTimer = setTimeout(openEditor, 700); }
    function cancelPress() { clearTimeout(pressTimer); }
    [$('#brand-logo'), $('#footer-rose')].forEach(function (el) {
      el.addEventListener('pointerdown', startPress);
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { el.addEventListener(ev, cancelPress); });
      el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'e') { e.preventDefault(); openEditor(); }
    });
    $('#guest-back').addEventListener('click', function () { location.hash = ''; });
    window.addEventListener('hashchange', boot);
  }
  function boot() {
    if (state.suppressHash) { state.suppressHash = false; return; }
    var hash = location.hash.replace(/^#/, '');
    var params = new URLSearchParams(hash);
    var d = params.get('d');
    if (d) {
      try {
        state.data = normalize(decodeData(d));
        state.mode = 'guest'; render();
        $('#guest-banner').hidden = false;
        return;
      } catch (e) { toast('分享链接内容有误，已加载你的本地版本'); }
    }
    state.data = loadLocal() || clone(DEFAULTS);
    state.mode = 'owner';
    // 一次性迁移：此前保存的空头像升级为项目内默认头像
    try {
      if (!localStorage.getItem('resume.avatar.default.v1')) {
        if (!state.data.profile.avatar) state.data.profile.avatar = 'avatar.jpg';
        localStorage.setItem('resume.avatar.default.v1', '1');
      }
    } catch (e) {}
    $('#guest-banner').hidden = true;
    saveLocal(state.data);
    render();
    if (params.get('edit') === '1') openEditor();
  }

  bindEditor();
  bindGlobal();
  boot();
})();
