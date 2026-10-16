(() => {
  const storageKey = 'markdownlive:reader';
  const menuIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18v2H3V6m0 5h18v2H3v-2m0 5h18v2H3v-2Z"/></svg>';
  let pendingKey = '';
  let pendingTimer;
  let state = readState();

  function readState() {
    try { return { navHidden: false, ...JSON.parse(localStorage.getItem(storageKey) || '{}') }; }
    catch (_) { return { navHidden: false }; }
  }
  function saveState() { localStorage.setItem(storageKey, JSON.stringify(state)); }
  function isEditable(target) { return target.matches('input, textarea, select, [contenteditable="true"]'); }
  function notify(message) {
    let status = document.querySelector('.ml-sidebar-status');
    if (!status) {
      status = document.createElement('div');
      status.className = 'ml-sidebar-status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      document.body.append(status);
    }
    status.textContent = message;
    status.dataset.visible = 'true';
    setTimeout(() => { status.dataset.visible = 'false'; }, 1500);
  }
  function applyNavigation() {
    document.body.classList.toggle('ml-nav-hidden', state.navHidden);
    const button = document.querySelector('.ml-nav-toggle');
    const label = state.navHidden ? 'Show navigation menu' : 'Hide navigation menu';
    button?.setAttribute('aria-label', label);
    button?.setAttribute('aria-pressed', String(!state.navHidden));
    if (button) button.title = label;
  }
  function toggleNavigation() {
    state.navHidden = !state.navHidden;
    saveState();
    applyNavigation();
    notify(`Navigation menu ${state.navHidden ? 'hidden' : 'shown'}`);
  }
  function mount() {
    const title = document.querySelector('.md-header__title');
    if (title && !document.querySelector('.ml-nav-toggle')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'md-header__button md-icon ml-nav-toggle';
      button.innerHTML = menuIcon;
      button.addEventListener('click', toggleNavigation);
      title.insertAdjacentElement('afterend', button);
    }
    applyNavigation();
  }
  function openSearch() {
    document.querySelector('label[for="__search"]')?.click();
    setTimeout(() => document.querySelector('.md-search__input')?.focus(), 50);
  }
  function movePage(direction) {
    document.querySelector(direction < 0 ? '.md-footer__link--prev' : '.md-footer__link--next')?.click();
  }
  function moveHeading(direction) {
    const headings = [...document.querySelectorAll('.md-content h2[id], .md-content h3[id]')];
    const y = scrollY + 12;
    const target = direction > 0
      ? headings.find(heading => heading.offsetTop > y)
      : headings.filter(heading => heading.offsetTop < y).at(-1);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  async function copyPageLink() {
    await navigator.clipboard.writeText(location.href);
    notify('Page link copied');
  }

  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openSearch();
      return;
    }
    if (isEditable(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
    const actions = {
      j: () => scrollBy({ top: 80, behavior: 'smooth' }), k: () => scrollBy({ top: -80, behavior: 'smooth' }),
      d: () => scrollBy({ top: innerHeight / 2, behavior: 'smooth' }), u: () => scrollBy({ top: -innerHeight / 2, behavior: 'smooth' }),
      G: () => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }),
      h: () => movePage(-1), l: () => movePage(1), '[': () => moveHeading(-1), ']': () => moveHeading(1),
      '/': openSearch, b: toggleNavigation
    };
    if (event.key === 'g' || event.key === 'y') {
      if (pendingKey === event.key) {
        event.preventDefault();
        if (event.key === 'g') scrollTo({ top: 0, behavior: 'smooth' });
        else copyPageLink();
        pendingKey = '';
        clearTimeout(pendingTimer);
      } else {
        pendingKey = event.key;
        clearTimeout(pendingTimer);
        pendingTimer = setTimeout(() => { pendingKey = ''; }, 600);
      }
      return;
    }
    if (actions[event.key]) { event.preventDefault(); actions[event.key](); }
  });

  if (typeof document$ !== 'undefined') document$.subscribe(mount);
  else document.addEventListener('DOMContentLoaded', mount);
})();
