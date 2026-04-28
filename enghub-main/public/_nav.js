(function () {
  if (window.__nav_loaded) return;
  window.__nav_loaded = true;

  const PANELS = [
    { href: '/agenda.html',           label: 'Доска повестки',                emoji: '📋' },
    { href: '/qa-review.html',        label: 'QA обзор',                      emoji: '🐛' },
    { href: '/design-diff.html',      label: 'Дизайн-диф',                    emoji: '🎨' },
    { href: '/health-map.html',       label: 'Карта здоровья',                emoji: '🏥' },
    { href: '/feature-picker.html',   label: 'Выбор фич',                     emoji: '✅' },
    { href: '/all-questions.html',    label: 'Все вопросы',                   emoji: '❓' },
    { href: '/automation-ideas.html', label: 'Идеи автоматизации (ручная)',   emoji: '💡' },
    { href: '/parsing.html',          label: 'Поток болей',                   emoji: '🔥' },
  ];

  const cur = (window.location.pathname || '/').replace(/\/$/, '') || '/';
  const isActive = (href) => {
    const a = href.replace(/\.html$/, '');
    const c = cur.replace(/\.html$/, '');
    return a === c;
  };

  const css = `
.__nav-btn{position:fixed;top:10px;right:10px;z-index:99999;width:32px;height:32px;border-radius:50%;
  background:rgba(18,25,51,.92);color:#8d96b3;border:1px solid #232a4a;cursor:pointer;
  display:flex;align-items:center;justify-content:center;font-size:16px;line-height:1;
  transition:.15s;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);box-shadow:0 2px 8px rgba(0,0,0,.25)}
.__nav-btn:hover,.__nav-btn[data-open="1"]{background:#1c2444;color:#4f8cff;border-color:#4f8cff}
.__nav-menu{position:fixed;top:50px;right:10px;z-index:99999;background:#121933;border:1px solid #232a4a;
  border-radius:9px;padding:5px;min-width:248px;box-shadow:0 12px 28px rgba(0,0,0,.5);display:none;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.__nav-menu.open{display:block;animation:__navIn .12s ease-out}
@keyframes __navIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
.__nav-menu .__nav-hdr{font-size:10px;color:#8d96b3;text-transform:uppercase;letter-spacing:.05em;
  padding:6px 11px 4px}
.__nav-menu a{display:flex;align-items:center;gap:9px;padding:7px 11px;color:#e9ecf3;
  text-decoration:none;font-size:13px;border-radius:5px;transition:.12s;line-height:1.35}
.__nav-menu a:hover{background:#182040;color:#fff}
.__nav-menu a.active{background:#4f8cff;color:#fff;font-weight:600}
.__nav-menu a.active:hover{background:#3b75e0}
.__nav-menu a .__em{font-size:14px;width:18px;text-align:center;flex-shrink:0}
.__nav-menu a .__lbl{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.__nav-menu hr{border:0;border-top:1px solid #232a4a;margin:5px 6px}
@media (max-width:480px){.__nav-menu{right:6px;min-width:210px}}
`;

  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  const btn = document.createElement('button');
  btn.className = '__nav-btn';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Панели EngHub');
  btn.title = 'Панели EngHub';
  btn.textContent = '⋮';
  document.body.appendChild(btn);

  const menu = document.createElement('div');
  menu.className = '__nav-menu';
  let html = '<div class="__nav-hdr">Панели EngHub</div>';
  PANELS.forEach((p) => {
    html += `<a href="${p.href}" class="${isActive(p.href) ? 'active' : ''}">`
         +  `<span class="__em">${p.emoji}</span><span class="__lbl">${p.label}</span></a>`;
  });
  menu.innerHTML = html;
  document.body.appendChild(menu);

  function setOpen(open) {
    menu.classList.toggle('open', !!open);
    btn.dataset.open = open ? '1' : '0';
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(!menu.classList.contains('open'));
  });
  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target) && e.target !== btn) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });
})();
