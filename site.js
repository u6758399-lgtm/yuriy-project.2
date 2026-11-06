'use strict';
const app = document.querySelector('#app');
const modalRoot = document.querySelector('#modal-root');
const toastEl = document.querySelector('#toast');
const isAdmin = location.pathname === '/admin';
let csrf = null;
let sessionInfo = null;
let site = null;
let tab = 'overview';
let busy = false;
let toastTimer;
const nav = [
  ['overview','◫','Главная'], ['profile','◇','Моя страница'],
  ['projects','▦','Проекты'], ['tasks','☑','Задачи'],
  ['notes','▤','Заметки'], ['files','▣','Файлы'],
  ['messages','✉','Сообщения'], ['settings','⚙','Настройки']
];
const pageTitles = Object.fromEntries(nav.map(x => [x[0], x[2]]));
const esc = (x='') => String(x ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const initial = (name) => (String(name || 'Я').trim().charAt(0) || 'Я').toUpperCase();
const niceDate = (s) => { if (!s) return 'Без даты'; const d = new Date(s); return Number.isNaN(+d) ? s : d.toLocaleDateString('ru-RU',{day:'numeric',month:'short',year:'numeric'}); };
const fileSize = n => n<1024 ? `${n} Б` : n<1024*1024 ? `${(n/1024).toFixed(1)} КБ` : `${(n/1024/1024).toFixed(1)} МБ`;
const statusName = s => ({todo:'В планах',progress:'В работе',done:'Готово'}[s] || 'В планах');
const safeHref = s => /^https?:\/\//i.test(s||'') ? esc(s) : '';
const telegramHandle = x => String(x||'').replace(/^@/,'').replace(/^https?:\/\/t\.me\//i,'');
const fields = form => Object.fromEntries(new FormData(form).entries());
function toast(message, bad=false) { clearTimeout(toastTimer); toastEl.textContent = message; toastEl.className=(bad?'show bad':'show'); toastTimer=setTimeout(()=>toastEl.className='',4500); }
async function request(path, opts={}) {
  const headers={...(opts.headers||{})};
  if(opts.body && !(opts.body instanceof Blob) && typeof opts.body !== 'string'){
    headers['Content-Type']='application/json'; opts.body=JSON.stringify(opts.body);
  }
  if(opts.method && opts.method!=='GET' && csrf) headers['X-CSRF-Token']=csrf;
  let res;
  try { res=await fetch(path,{...opts,headers,credentials:'same-origin'}); }
  catch { throw new Error('Нет связи с сервером. Проверьте, запущен ли сайт.'); }
  if (!res.ok) {
    const d=await res.json().catch(()=>({}));
    if(res.status===401 && isAdmin){ csrf=null; site=null; renderAuth(); }
    throw new Error(d.error||`Ошибка ${res.status}`);
  }
  if((res.headers.get('content-type')||'').includes('application/json')) return res.json();
  return res;
}
async function refresh() { site=await request('/api/admin/state'); renderAdmin(); }
function avatar(profile, className='preview-initial') {
  return profile.avatar_file ? `<img src="/media/${esc(profile.avatar_file)}" alt="Фото профиля">` : `<span class="${className}">${esc(initial(profile.name))}</span>`;
}
function socialLinks(p) {
  const links=[];
  if(p.email) links.push(`<a href="mailto:${esc(p.email)}">✉ &nbsp;${esc(p.email)}</a>`);
  if(p.telegram && /^[a-zA-Z0-9_]{5,32}$/.test(telegramHandle(p.telegram))) links.push(`<a target="_blank" rel="noopener noreferrer" href="https://t.me/${esc(telegramHandle(p.telegram))}">↗ &nbsp;Telegram</a>`);
  if(safeHref(p.website)) links.push(`<a target="_blank" rel="noopener noreferrer" href="${safeHref(p.website)}">◎ &nbsp;Мой сайт</a>`);
  return links.join('');
}
function renderPublic(data) {
  const p=data.profile; const projects=data.projects;
  document.title = `${p.name} — личный сайт`;
  const tiles=projects.length ? projects.map((x,i) => `<article class="card project-card">
    <div class="project-symbol">${['✦','◈','⌘','✳','◇','◉'][i%6]}</div>
    <div><span class="badge">${esc(x.category||'Проект')}</span></div>
    <h3>${esc(x.title)}</h3><p>${esc(x.description)}</p>
    <div class="project-card-footer"><span class="muted" style="font-size:12px">${niceDate(x.created_at)}</span>${safeHref(x.url)?`<a class="text-link" href="${safeHref(x.url)}" target="_blank" rel="noopener noreferrer">Посмотреть ↗</a>`:'<span class="muted">Личный проект</span>'}</div>
  </article>`).join('') : `<div class="empty" style="grid-column:1/-1"><div class="empty-icon">✧</div><b>Здесь появятся мои проекты</b><p>Раздел заполняется в личном кабинете.</p></div>`;
  app.innerHTML=`<div class="public-page">
  <header class="container site-top"><a class="brand" href="/"><span class="logo">✦</span><span>Yuriy<span class="gradient-text"> Project</span></span></a><nav class="top-nav"><a href="#about">Обо мне</a><a href="#projects">Проекты</a><a href="#contact">Связаться</a><a class="nav-action" href="/admin">Личный кабинет ↗</a></nav></header>
  <main>
   <section class="container hero"><div><span class="pill"><span class="dot"></span> ДОБРО ПОЖАЛОВАТЬ НА МОЙ САЙТ</span><h1>Привет, я <span class="gradient-text">${esc(p.name)}.</span></h1><p class="hero-desc">${esc(p.bio)}</p><div class="hero-actions"><a class="btn btn-primary" href="#projects">Посмотреть проекты <span>↗</span></a><a class="btn btn-ghost" href="#contact">Написать мне</a></div><div class="hero-detail"><span>✦ ${esc(p.role)}</span>${p.location?`<span>⌖ ${esc(p.location)}</span>`:''}</div></div>
   <div class="hero-visual"><div class="orb"></div><div class="portrait">${p.avatar_file?`<img src="/media/${esc(p.avatar_file)}" alt="Фото ${esc(p.name)}">`:`<span class="portrait-initial">${esc(initial(p.name))}</span>`}<div class="portrait-tag"><strong>${esc(p.name)}</strong><span>${esc(p.role)}</span></div></div><div class="floating-mark">✧ &nbsp; Создаю своё</div></div></section>
   <div class="container stats"><div class="stat-public"><strong>${projects.length}</strong><span>Проектов</span></div><div class="stat-public"><strong>01</strong><span>Личное пространство</span></div><div class="stat-public"><strong>∞</strong><span>Новых идей</span></div></div>
   <section id="about" class="container section about-grid"><div class="about-intro"><span class="eyebrow">Знакомство</span><h2>Немного <span class="gradient-text">обо мне.</span></h2><p>Здесь можно узнать, чем я занимаюсь и что для меня действительно важно.</p></div><div class="card about-card"><p>${esc(p.about)}</p><div class="about-tags"><span>✦ Мой путь</span><span>◈ Мои идеи</span><span>◎ Мои проекты</span></div></div></section>
   <section id="projects" class="container section"><div class="section-heading"><div><span class="eyebrow">То, что я создаю</span><h2>Мои <span class="gradient-text">проекты.</span></h2><p>Здесь собраны мои работы, идеи и полезные инициативы.</p></div></div><div class="project-grid">${tiles}</div></section>
   <section id="contact" class="container section contact-grid"><div class="contact-copy"><span class="eyebrow">На связи</span><h2>Давай <span class="gradient-text">пообщаемся.</span></h2><p>Есть вопрос, идея или предложение? Напиши через форму — сообщение появится в моём личном кабинете.</p><div class="contact-links">${socialLinks(p)}</div></div><form id="contact-form" class="card contact-form"><div class="field-row"><div class="field"><label for="c-name">Твоё имя</label><input id="c-name" name="name" placeholder="Как тебя зовут?" required minlength="2" maxlength="100"></div><div class="field"><label for="c-email">Email для ответа</label><input id="c-email" type="email" name="email" placeholder="name@example.com" required maxlength="150"></div></div><div class="field"><label for="c-message">Сообщение</label><textarea id="c-message" name="message" required minlength="5" maxlength="3000" placeholder="Напиши своё сообщение..."></textarea></div><div class="hp-field" aria-hidden="true"><label for="website-field">Сайт</label><input id="website-field" name="website" tabindex="-1" autocomplete="off"></div><button type="submit" class="btn btn-primary">Отправить сообщение ↗</button><p style="font-size:11px;margin-top:12px">Сообщение сохранится на сервере владельца сайта.</p></form></section>
  </main><footer class="container footer"><span>© ${new Date().getFullYear()} ${esc(p.name)}. Моё пространство.</span><a href="/admin">Вход для владельца</a></footer></div>`;
}
function renderAuth() {
  document.title = 'Вход — личный кабинет';
  const setup = sessionInfo?.setup_required;
  const allowed = sessionInfo?.setup_allowed;
  app.innerHTML=`<div class="auth-page"><div class="card auth-card"><a class="brand" href="/"><span class="logo">✦</span><span>Yuriy<span class="gradient-text"> Project</span></span></a>
    <h1>${setup?'Первоначальная настройка':'С возвращением!'}</h1>
    <p>${setup?'Создайте пароль владельца — он защитит личные файлы, заметки и настройки.':'Войдите, чтобы управлять своим сайтом, проектами и личными данными.'}</p>
    ${setup && !allowed?`<div class="muted-box">Первый пароль нужно установить на том же компьютере, где запущен сайт: откройте <b>http://127.0.0.1:8000/admin</b>.</div>`:
    `<form id="${setup?'setup-form':'login-form'}"><div class="field"><label for="password">${setup?'Придумайте пароль':'Пароль'}</label><input id="password" name="password" type="password" autocomplete="${setup?'new-password':'current-password'}" placeholder="Не менее ${setup?'10':'1'} символов" ${setup?'minlength="10"':''} required autofocus></div>${setup?'<p class="field-hint" style="margin:-5px 0 18px">Используйте уникальный пароль. Не сообщайте его другим.</p>':''}<button class="btn btn-primary" type="submit">${setup?'Создать мой кабинет':'Войти в кабинет'} ↗</button></form>`}
    <div class="auth-sub"><a href="/">← Вернуться на сайт</a></div></div></div>`;
}
function sidebar() {
  const pending=site.messages.filter(x=>!x.is_read).length;
  return `<aside class="sidebar"><a href="/" class="brand"><span class="logo">✦</span><span>Yuriy<span class="gradient-text"> Project</span></span></a><div class="sidebar-kicker">Управление</div><nav class="menu">${nav.map(([id,ico,label])=>`<button type="button" class="${tab===id?'active':''}" data-tab="${id}"><span style="font-size:19px;width:20px;text-align:center">${ico}</span> ${label}${id==='messages'&&pending?`<span class="count">${pending}</span>`:''}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="sidebar-user">${site.profile.avatar_file?`<img src="/media/${esc(site.profile.avatar_file)}" alt="" style="width:35px;height:35px;border-radius:10px;object-fit:cover">`:`<span class="round-initial">${esc(initial(site.profile.name))}</span>`}<span style="min-width:0"><b class="user-name truncate">${esc(site.profile.name)}</b><small>Владелец сайта</small></span></div><button class="btn btn-ghost" style="margin-top:12px;width:100%" data-action="logout">⇥ Выйти</button></div></aside>`;
}
function mobileNav() {
  return `<nav class="mobile-nav" aria-label="Навигация по кабинету">${[['overview','⌂','Главная'],['projects','▦','Проекты'],['tasks','☑','Задачи'],['notes','▤','Заметки'],['files','▣','Файлы'],['more','☷','Ещё']].map(([id,ico,label])=>`<button class="${tab===id?'active':''}" ${id==='more'?'data-action="mobile-more"':`data-tab="${id}"`}><span>${ico}</span>${label}</button>`).join('')}</nav>`;
}
function head(title, subtitle, button='') {return `<div class="page-head"><div><h1>${title}</h1><p>${subtitle}</p></div>${button}</div>`;}
function renderAdmin() {
  if(!site) return;
  document.title=`${pageTitles[tab]} — личный кабинет`;
  let inner;
  switch(tab) {
    case 'overview': inner=renderOverview();break;
    case 'profile': inner=renderProfile();break;
    case 'projects': inner=renderProjects();break;
    case 'tasks': inner=renderTasks();break;
    case 'notes': inner=renderNotes();break;
    case 'files': inner=renderFiles();break;
    case 'messages': inner=renderMessages();break;
    case 'settings': inner=renderSettings();break;
    default: inner=renderOverview();
  }
  app.innerHTML=`<div class="admin">${sidebar()}<main class="main"><div class="admin-top"><span class="breadcrumb">Личный кабинет / ${esc(pageTitles[tab])}</span><div class="admin-actions"><a class="btn btn-sm btn-ghost" href="/" target="_blank" rel="noopener noreferrer">↗ Посмотреть сайт</a><div class="avatar-small">${esc(initial(site.profile.name))}</div></div></div>${inner}<div class="admin-footer">Ваши данные хранятся на компьютере, где запущен сервер сайта.</div></main>${mobileNav()}</div>`;
}
function renderOverview() {
  const todo=site.tasks.filter(x=>x.status!=='done'); const newmsg=site.messages.filter(x=>!x.is_read);
  return `<div class="eyebrow">Панель управления</div>${head(`Привет, ${esc(site.profile.name)} ✦`,'Здесь всё важное под рукой. Управляйте своим пространством из одного места.')}
  <div class="card dashboard-welcome"><div><h2>Это ваше пространство.</h2><p>Добавляйте проекты, сохраняйте мысли и следите за делами.</p></div><button class="btn btn-primary" data-tab="profile">Настроить страницу ↗</button></div>
  <div class="dashboard-stats"><div class="card metric"><div class="metric-icon">▦</div><strong class="number">${site.projects.length}</strong><span class="metric-title">Проектов</span></div><div class="card metric"><div class="metric-icon">☑</div><strong class="number">${todo.length}</strong><span class="metric-title">Активных задач</span></div><div class="card metric"><div class="metric-icon">▤</div><strong class="number">${site.notes.length}</strong><span class="metric-title">Заметок</span></div><div class="card metric"><div class="metric-icon">✉</div><strong class="number">${newmsg.length}</strong><span class="metric-title">Новых сообщений</span></div></div>
  <div class="split"><section class="card panel"><div class="panel-head"><h3>Ближайшие дела</h3><button class="btn btn-sm btn-ghost" data-tab="tasks">Все задачи ↗</button></div>${todo.length?todo.slice(0,5).map(x=>`<div class="list-row"><span class="row-icon">☑</span><div class="grow"><b>${esc(x.title)}</b><small>${x.due_date?`Срок: ${esc(x.due_date)}`:'Без срока'} · ${statusName(x.status)}</small></div><span class="badge">${statusName(x.status)}</span></div>`).join(''):`<div class="empty"><div class="empty-icon">✓</div><b>Всё под контролем</b><p>Пока нет активных задач.</p></div>`}</section>
  <section class="card panel"><div class="panel-head"><h3>Быстрые действия</h3></div><div class="quick-actions"><button class="quick-action" data-action="new-note"><span>▤</span><b>Новая заметка ↗</b></button><button class="quick-action" data-action="new-project"><span>▦</span><b>Добавить проект ↗</b></button><button class="quick-action" data-tab="files"><span>▣</span><b>Мои файлы ↗</b></button><button class="quick-action" data-tab="messages"><span>✉</span><b>Сообщения (${newmsg.length}) ↗</b></button></div></section></div>`;
}
function renderProfile() {
  const p=site.profile;
  return `${head('Моя страница','Отредактируйте информацию, которую увидят посетители публичного сайта.')}
  <div class="edit-grid"><form class="card panel" id="profile-form"><div class="panel-head"><h3>Основная информация</h3><span class="badge">Публично</span></div>
    <div class="field-row"><div class="field"><label>Ваше имя</label><input name="name" maxlength="100" required value="${esc(p.name)}"></div><div class="field"><label>Род занятий / подпись</label><input name="role" maxlength="100" value="${esc(p.role)}"></div></div>
    <div class="field"><label>Город или местоположение (необязательно)</label><input name="location" maxlength="120" value="${esc(p.location)}" placeholder="Например, Берлин"></div>
    <div class="field"><label>Краткое представление</label><textarea name="bio" maxlength="500" rows="4">${esc(p.bio)}</textarea></div>
    <div class="field"><label>Раздел «Обо мне»</label><textarea name="about" maxlength="4000" rows="7">${esc(p.about)}</textarea></div>
    <div class="field-row"><div class="field"><label>Email (публичный)</label><input type="email" name="email" maxlength="150" value="${esc(p.email)}" placeholder="you@example.com"></div><div class="field"><label>Telegram</label><input name="telegram" maxlength="150" value="${esc(p.telegram)}" placeholder="@username"></div></div>
    <div class="field"><label>Ссылка на сайт / соцсеть</label><input type="url" name="website" maxlength="300" value="${esc(p.website)}" placeholder="https://..."></div>
    <div class="form-actions"><button class="btn btn-primary" type="submit">Сохранить изменения ↗</button><a href="/" target="_blank" class="btn btn-ghost">Предпросмотр</a></div></form>
  <div><div class="card preview-card"><div class="panel-head"><h3>Фото профиля</h3></div><div class="preview-profile">${avatar(p)}<div><h3>${esc(p.name)}</h3><small>${esc(p.role)}</small></div></div><label class="upload-box" style="display:block"><b>↑ Выбрать фотографию</b><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" id="avatar-upload" style="margin-top:12px"><p>JPEG, PNG, WEBP или GIF. До 5 МБ. Фото будет видно всем посетителям.</p></label></div>
  <div class="muted-box" style="margin-top:20px">✦ <b>Подсказка:</b> изменения страницы сразу появляются на публичном сайте после сохранения.</div></div></div>`;
}
function renderProjects() {
  return `${head('Мои проекты','Работы и идеи, которые отображаются на публичной странице.', '<button class="btn btn-primary" data-action="new-project">+ Новый проект</button>')}
    <div class="card table-panel">${site.projects.length?site.projects.map(p=>`<div class="list-row"><span class="row-icon">▦</span><div class="grow"><b>${esc(p.title)}</b><small>${esc(p.category||'Без категории')} · ${esc(p.description).slice(0,130)}</small></div><div class="row-actions"><button class="btn btn-sm" data-action="edit-project" data-id="${p.id}">Изменить</button><button class="btn btn-sm btn-danger" data-action="delete-project" data-id="${p.id}">Удалить</button></div></div>`).join(''):`<div class="empty"><div class="empty-icon">▦</div><b>Пока нет проектов</b><p>Добавьте первый — он автоматически появится на вашем сайте.</p></div>`}</div>`;
}
function renderTasks() {
  const opts=x=>['todo','progress','done'].map(s=>`<option value="${s}" ${x.status===s?'selected':''}>${statusName(s)}</option>`).join('');
  return `${head('Мои задачи','Планируйте дела и отмечайте выполненные.', '')}
   <form class="card panel" id="task-form" style="margin-bottom:20px"><div class="panel-head"><h3>Добавить задачу</h3></div><div class="field-row"><div class="field"><label>Что нужно сделать?</label><input name="title" required maxlength="200" placeholder="Например, обновить сайт"></div><div class="field"><label>Срок (необязательно)</label><input name="due_date" type="date"></div></div><button class="btn btn-primary" type="submit">+ Добавить задачу</button></form>
   <div class="card table-panel">${site.tasks.length?site.tasks.map(t=>`<div class="list-row"><span class="row-icon"><span class="status-dot ${t.status==='done'?'done':''}"></span>☑</span><div class="grow"><b style="${t.status==='done'?'text-decoration:line-through;color:#8c9ab3':''}">${esc(t.title)}</b><small>${t.due_date?'Срок: '+esc(t.due_date):'Без срока'} · Создано ${niceDate(t.created_at)}</small></div><div class="row-actions"><select class="task-status" data-task="${t.id}" aria-label="Статус задачи">${opts(t)}</select><button class="btn btn-sm btn-danger" data-action="delete-task" data-id="${t.id}">Удалить</button></div></div>`).join(''):`<div class="empty"><div class="empty-icon">✓</div><b>Список чист</b><p>Добавьте задачу, чтобы начать планирование.</p></div>`}</div>`;
}
function renderNotes() {
  return `${head('Мои заметки','Идеи, записи и важная информация. Заметки видны только после входа.', '<button class="btn btn-primary" data-action="new-note">+ Новая заметка</button>')}
  <div class="card table-panel">${site.notes.length?site.notes.map(n=>`<div class="list-row"><span class="row-icon">▤</span><div class="grow"><b>${esc(n.title)}</b><small>${niceDate(n.updated_at)}</small><div class="note-preview">${esc(n.body||'Пустая заметка')}</div></div><div class="row-actions"><button class="btn btn-sm" data-action="edit-note" data-id="${n.id}">Открыть</button><button class="btn btn-sm btn-danger" data-action="delete-note" data-id="${n.id}">Удалить</button></div></div>`).join(''):`<div class="empty"><div class="empty-icon">▤</div><b>Свежая страница</b><p>Запишите первую мысль, план или идею.</p></div>`}</div>`;
}
function renderFiles() {
  return `${head('Мои файлы','Личное хранилище. Файлы доступны только после входа в кабинет.')}
    <div class="card panel" style="margin-bottom:20px"><div class="file-drop" id="file-drop"><div style="font-size:34px;color:var(--purple)">▣</div><h3>Перетащите файлы сюда</h3><p>Или выберите файлы на своём устройстве.</p><input id="file-upload" type="file" multiple style="margin:18px auto 0"><p class="field-hint">Размер каждого файла — не более 20 МБ. Файлы сохраняются на сервере.</p></div></div>
    <div class="card table-panel">${site.files.length?site.files.map(f=>`<div class="list-row"><span class="row-icon">▣</span><div class="grow"><b>${esc(f.filename)}</b><small>${fileSize(f.size)} · ${niceDate(f.uploaded_at)}</small></div><div class="row-actions"><a class="btn btn-sm" href="/api/admin/files/${f.id}/download">Скачать ↓</a><button class="btn btn-sm btn-danger" data-action="delete-file" data-id="${f.id}">Удалить</button></div></div>`).join(''):`<div class="empty"><div class="empty-icon">▣</div><b>Пока нет файлов</b><p>Загрузите документы, фото или другие материалы для личного хранения.</p></div>`}</div>`;
}
function renderMessages() {
  return `${head('Сообщения','Письма, отправленные через контактную форму публичного сайта.')}
    ${site.messages.length?site.messages.map(m=>`<article class="card message-card ${m.is_read?'':'new'}"><div class="message-head"><div><h3>${esc(m.name)} ${m.is_read?'':'<span class="badge">Новое</span>'}</h3><small>${esc(m.email)} · ${niceDate(m.created_at)}</small></div><div class="row-actions"><button class="btn btn-sm" data-action="toggle-message" data-id="${m.id}">${m.is_read?'Отметить непрочитанным':'Прочитано ✓'}</button><button class="btn btn-sm btn-danger" data-action="delete-message" data-id="${m.id}">Удалить</button></div></div><p>${esc(m.body)}</p><div class="message-meta"><a class="text-link" href="mailto:${esc(m.email)}">Ответить по email ↗</a></div></article>`).join(''):`<div class="empty"><div class="empty-icon">✉</div><b>Входящих нет</b><p>Новые сообщения появятся здесь автоматически.</p></div>`}`;
}
function renderSettings() {
  return `${head('Настройки','Безопасность, резервные копии и управление аккаунтом.')}
   <div class="setting-grid"><section class="card setting-card"><h3>🔐 Сменить пароль</h3><p>Пользуйтесь длинным и уникальным паролем. Для сохранения нужен действующий.</p><form id="password-form"><div class="field"><label>Текущий пароль</label><input name="current" type="password" autocomplete="current-password" required></div><div class="field"><label>Новый пароль (от 10 символов)</label><input name="new" type="password" autocomplete="new-password" minlength="10" required></div><button class="btn btn-primary" type="submit">Обновить пароль</button></form></section>
   <section class="card setting-card"><h3>↓ Резервная копия</h3><p>Скачайте ZIP-архив с проектами, задачами, заметками, сообщениями и личными файлами.</p><a class="btn btn-primary" href="/api/admin/backup">Скачать архив ↓</a><p class="help-text" style="margin-top:17px">Храните архив в надёжном месте: внутри могут находиться ваши личные данные. Восстановление из архива вручную.</p></section>
   <section class="card setting-card"><h3>🌐 Публичная страница</h3><p>Сайт виден по адресу сервера, а кабинет открывается по адресу <b>/admin</b>.</p><a class="btn" href="/" target="_blank">Открыть мой сайт ↗</a></section>
   <section class="card setting-card"><h3>ℹ Сведения</h3><p>Сайт работает на Python и SQLite, без сторонних библиотек. Все данные расположены на вашем сервере в папке <b>data</b>.</p><div class="muted-box">Для публикации в интернете потребуются хостинг, домен, HTTPS и дополнительная настройка безопасности.</div></section></div>`;
}
function showModal(title, content) {
  modalRoot.innerHTML=`<div class="modal-backdrop"><div class="card modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-title"><h2>${esc(title)}</h2><button class="btn btn-round" data-action="close-modal" aria-label="Закрыть">✕</button></div>${content}</div></div>`;
  modalRoot.querySelector('input,textarea')?.focus();
}
function closeModal() { modalRoot.innerHTML=''; }
function editProject(id=null) {
  const obj = site.projects.find(x=>x.id===Number(id)) || {id:0,title:'',category:'',description:'',url:''};
  showModal(obj.id?'Изменить проект':'Новый проект', `<form id="project-form" data-id="${obj.id}"><div class="field"><label>Название проекта</label><input name="title" maxlength="120" value="${esc(obj.title)}" required placeholder="Название"></div><div class="field"><label>Категория</label><input name="category" maxlength="60" value="${esc(obj.category)}" placeholder="Например, творчество"></div><div class="field"><label>Описание</label><textarea name="description" maxlength="1200" rows="5" placeholder="Расскажите о проекте">${esc(obj.description)}</textarea></div><div class="field"><label>Ссылка (необязательно)</label><input name="url" type="url" maxlength="500" value="${esc(obj.url)}" placeholder="https://..."></div><button class="btn btn-primary" type="submit">${obj.id?'Сохранить проект':'Добавить проект'}</button></form>`);
}
function editNote(id=null) {
  const obj=site.notes.find(x=>x.id===Number(id))||{id:0,title:'',body:''};
  showModal(obj.id?'Редактировать заметку':'Новая заметка',`<form id="note-form" data-id="${obj.id}"><div class="field"><label>Заголовок</label><input name="title" maxlength="150" value="${esc(obj.title)}" required placeholder="Название заметки"></div><div class="field"><label>Текст</label><textarea name="body" maxlength="20000" rows="12" placeholder="Запишите мысли, планы, идеи...">${esc(obj.body)}</textarea></div><button class="btn btn-primary" type="submit">${obj.id?'Сохранить изменения':'Создать заметку'}</button></form>`);
}
async function run(action) {
  if(busy) return;
  busy=true;
  try { await action(); } catch(e) {toast(e.message||'Неизвестная ошибка',true);} finally {busy=false;}
}
async function uploadFiles(files) {
  if(!files || !files.length) return;
  await run(async()=>{
    let count=0;
    for(const file of files) {
      if(file.size>20*1024*1024) {toast(`Файл ${file.name} больше 20 МБ`,true);continue;}
      await request('/api/admin/files',{method:'POST',headers:{'X-File-Name':encodeURIComponent(file.name),'Content-Type':'application/octet-stream'},body:file});
      count++;
    }
    await refresh(); if(count) toast(`Загружено файлов: ${count}`);
  });
}
app.addEventListener('click', async e=>{
  const tabButton=e.target.closest('[data-tab]');
  if(tabButton) {tab=tabButton.dataset.tab;renderAdmin();scrollTo({top:0,behavior:'smooth'});return;}
  const button=e.target.closest('[data-action]');
  if(!button) return;
  const action=button.dataset.action, id=Number(button.dataset.id);
  if(action==='mobile-more') {showModal('Разделы кабинета', `<div class="menu">${nav.map(([id,ico,label])=>`<button type="button" data-tab="${id}"><span style="font-size:19px;width:20px">${ico}</span>${label}</button>`).join('')}</div>`); return;}
  if(action==='new-project') return editProject();
  if(action==='edit-project') return editProject(id);
  if(action==='new-note') return editNote();
  if(action==='edit-note') return editNote(id);
  if(action==='close-modal') return closeModal();
  if(action==='logout') return run(async()=>{await request('/api/logout',{method:'POST'});csrf=null;site=null;sessionInfo={setup_required:false};renderAuth();toast('Вы вышли из кабинета');});
  const config={
    'delete-project':['projects','Удалить этот проект?'],
    'delete-task':['tasks','Удалить задачу?'],
    'delete-note':['notes','Удалить заметку?'],
    'delete-file':['files','Удалить файл без возможности восстановления?'],
    'delete-message':['messages','Удалить сообщение?']
  }[action];
  if(config) {
    if(!confirm(config[1])) return;
    return run(async()=>{await request(`/api/admin/${config[0]}/${id}`,{method:'DELETE'});await refresh();toast('Удалено');});
  }
  if(action==='toggle-message') {
    const m=site.messages.find(x=>x.id===id);
    return run(async()=>{await request(`/api/admin/messages/${id}`,{method:'PUT',body:{is_read:!m.is_read}});await refresh();});
  }
});
app.addEventListener('change', async e=>{
  if(e.target.matches('select[data-task]')) {
    const id=Number(e.target.dataset.task), status=e.target.value;
    return run(async()=>{await request(`/api/admin/tasks/${id}`,{method:'PUT',body:{status}});await refresh();toast('Статус изменён');});
  }
  if(e.target.id==='avatar-upload' && e.target.files.length) {
    const file=e.target.files[0];
    if(file.size>5*1024*1024) return toast('Максимальный размер фотографии 5 МБ',true);
    return run(async()=>{await request('/api/admin/media/avatar',{method:'POST',headers:{'Content-Type':file.type||'application/octet-stream'},body:file});await refresh();toast('Фотография обновлена');});
  }
  if(e.target.id==='file-upload') return uploadFiles([...e.target.files]);
});
app.addEventListener('dragover', e=>{if(e.target.closest('#file-drop')) {e.preventDefault();e.target.closest('#file-drop').classList.add('dragover');}});
app.addEventListener('dragleave', e=>{if(e.target.closest('#file-drop'))e.target.closest('#file-drop').classList.remove('dragover');});
app.addEventListener('drop', e=>{if(e.target.closest('#file-drop')){e.preventDefault();e.target.closest('#file-drop').classList.remove('dragover');uploadFiles([...e.dataTransfer.files]);}});
modalRoot.addEventListener('click', e=>{
  const link=e.target.closest('[data-tab]');
  if(link){tab=link.dataset.tab;closeModal();renderAdmin();scrollTo({top:0,behavior:'smooth'});return;}
  if(e.target.classList.contains('modal-backdrop')||e.target.closest('[data-action="close-modal"]'))closeModal();
});
document.addEventListener('keydown', e=>{if(e.key==='Escape')closeModal();});
async function handleSubmit(e) {
  const form=e.target;
  if(!form.matches('form'))return;
  e.preventDefault();
  if(busy)return;
  const d=fields(form);
  await run(async()=>{
    switch(form.id){
      case 'contact-form':
        await request('/api/contact',{method:'POST',body:d});form.reset();toast('Сообщение отправлено!');break;
      case 'login-form':
        await request('/api/login',{method:'POST',body:d});sessionInfo=await request('/api/session');csrf=sessionInfo.csrf;await refresh();toast('Вы вошли в кабинет');break;
      case 'setup-form':
        await request('/api/setup',{method:'POST',body:d});await request('/api/login',{method:'POST',body:d});sessionInfo=await request('/api/session');csrf=sessionInfo.csrf;await refresh();toast('Личный кабинет создан!');break;
      case 'profile-form':
        await request('/api/admin/profile',{method:'PUT',body:d});await refresh();toast('Профиль сохранён');break;
      case 'project-form': {
        const id=Number(form.dataset.id);await request(id?`/api/admin/projects/${id}`:'/api/admin/projects',{method:id?'PUT':'POST',body:d});closeModal();await refresh();toast('Проект сохранён');break;
      }
      case 'note-form': {
        const id=Number(form.dataset.id);await request(id?`/api/admin/notes/${id}`:'/api/admin/notes',{method:id?'PUT':'POST',body:d});closeModal();await refresh();toast('Заметка сохранена');break;
      }
      case 'task-form':
        await request('/api/admin/tasks',{method:'POST',body:d});await refresh();toast('Задача добавлена');break;
      case 'password-form':
        await request('/api/admin/password',{method:'POST',body:d});form.reset();toast('Пароль изменён');break;
    }
  });
}
app.addEventListener('submit',handleSubmit);
modalRoot.addEventListener('submit',handleSubmit);
async function init() {
  try {
    if(isAdmin) {
      sessionInfo=await request('/api/session');csrf=sessionInfo.csrf;
      if(sessionInfo.authenticated) await refresh();else renderAuth();
    } else {
      const data=await request('/api/public');renderPublic(data);
    }
  } catch(e) {
    app.innerHTML=`<div class="auth-page"><div class="card auth-card"><h1>Не удалось открыть сайт</h1><p>${esc(e.message)}</p><button class="btn btn-primary" id="reload">Повторить ↻</button></div></div>`;
    document.querySelector('#reload')?.addEventListener('click',()=>location.reload());
  }
}
init();
