(() => {
  const storageKey = `markdownlive:sidebar:${location.host}${location.pathname.split('/').slice(0, 2).join('/')}`;
  const icons = {
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2Z"/></svg>',
    drag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h2v2H9V3m4 0h2v2h-2V3M9 7h2v2H9V7m4 0h2v2h-2V7m-4 4h2v2H9v-2m4 0h2v2h-2v-2m-4 4h2v2H9v-2m4 0h2v2h-2v-2m-4 4h2v2H9v-2m4 0h2v2h-2v-2Z"/></svg>',
    filter: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 12v7.88c.04.3-.06.62-.29.83a.996.996 0 0 1-1.41 0l-2.01-2.01a.989.989 0 0 1-.29-.83V12h-.03L4.21 4.62A1 1 0 0 1 5 3h14a1 1 0 0 1 .79 1.62L14.03 12H14Z"/></svg>',
    expand: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.41 8.58 12 13.17l4.59-4.59L18 10l-6 6-6-6 1.41-1.42Z"/></svg>',
    reset: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6V3l-4 4 4 4V8c2.76 0 5 2.24 5 5a5 5 0 0 1-5 5c-2.21 0-4.08-1.44-4.74-3.43l-1.9.62A7.002 7.002 0 0 0 19 13c0-3.87-3.13-7-7-7Z"/></svg>'
  };
  let statusTimer;

  const readState = () => {
    try {
      return { pins: [], order: [], pinnedOnly: false, ...JSON.parse(localStorage.getItem(storageKey) || '{}') };
    } catch (_) {
      return { pins: [], order: [], pinnedOnly: false };
    }
  };

  const writeState = state => localStorage.setItem(storageKey, JSON.stringify(state));
  const pageKey = link => new URL(link.href, location.href).pathname.replace(/\/$/, '') || '/';

  function announce(message) {
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
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { status.dataset.visible = 'false'; }, 1800);
  }

  function sortList(list, state) {
    const pages = [...list.children].filter(item => item.dataset.mlPage);
    const rank = key => {
      const index = state.order.indexOf(key);
      return index === -1 ? Number.MAX_SAFE_INTEGER : index;
    };
    pages.sort((a, b) => {
      const aKey = a.dataset.mlPage;
      const bKey = b.dataset.mlPage;
      const pinDifference = Number(state.pins.includes(bKey)) - Number(state.pins.includes(aKey));
      return pinDifference || rank(aKey) - rank(bKey);
    });
    pages.forEach(page => list.append(page));
  }

  function saveVisibleOrder(list, state) {
    const keys = [...list.children].map(item => item.dataset.mlPage).filter(Boolean);
    state.order = [...new Set([...keys, ...state.order])];
    writeState(state);
  }

  function actionButton(icon, label, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ml-sidebar-action';
    button.title = label;
    button.setAttribute('aria-label', label);
    button.innerHTML = icon;
    button.addEventListener('click', handler);
    return button;
  }

  function addToolbar(state) {
    const scrollwrap = document.querySelector('.md-sidebar--primary .md-sidebar__scrollwrap');
    if (!scrollwrap) return;
    let toolbar = scrollwrap.querySelector(':scope > .ml-sidebar-toolbar');
    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.className = 'ml-sidebar-toolbar';
      const label = document.createElement('span');
      label.className = 'ml-sidebar-toolbar__label';
      label.textContent = 'Organize';

      const filter = actionButton(icons.filter, 'Show pinned pages only', () => {
        const currentState = readState();
        currentState.pinnedOnly = !currentState.pinnedOnly;
        writeState(currentState);
        enhance();
        announce(currentState.pinnedOnly ? 'Showing pinned pages only' : 'Showing all pages');
      });
      filter.classList.add('ml-filter');

      const expand = actionButton(icons.expand, 'Expand or collapse all sections', () => {
        const toggles = [...document.querySelectorAll('.md-nav--primary input.md-nav__toggle')];
        const shouldExpand = toggles.some(toggle => !toggle.checked);
        toggles.forEach(toggle => { toggle.checked = shouldExpand; });
        announce(`${shouldExpand ? 'Expanded' : 'Collapsed'} all sections`);
      });

      const reset = actionButton(icons.reset, 'Reset pins and custom order', () => {
        localStorage.removeItem(storageKey);
        announce('Sidebar organization reset');
        setTimeout(() => location.reload(), 350);
      });
      toolbar.append(label, filter, expand, reset);
      scrollwrap.prepend(toolbar);
    }
    const filter = toolbar.querySelector('.ml-filter');
    filter?.setAttribute('aria-pressed', String(state.pinnedOnly));
    filter?.setAttribute('aria-label', state.pinnedOnly ? 'Show all pages' : 'Show pinned pages only');
    if (filter) filter.title = state.pinnedOnly ? 'Show all pages' : 'Show pinned pages only';
  }

  function enhance() {
    const state = readState();
    addToolbar(state);
    document.querySelectorAll('.md-nav--primary .md-nav__list').forEach(list => {
      const directItems = [...list.children];
      directItems.forEach(item => {
        if (item.dataset.mlPage) {
          const pinned = state.pins.includes(item.dataset.mlPage);
          const existingPin = item.querySelector(':scope > .ml-sidebar-controls > .ml-pin');
          item.dataset.mlPinned = String(pinned);
          item.hidden = state.pinnedOnly && !pinned;
          if (existingPin) {
            const existingTitle = item.querySelector(':scope > a.md-nav__link')?.textContent.trim() || 'page';
            existingPin.title = pinned ? 'Unpin page' : 'Pin page';
            existingPin.setAttribute('aria-label', `${pinned ? 'Unpin' : 'Pin'} ${existingTitle}`);
            existingPin.setAttribute('aria-pressed', String(pinned));
          }
          return;
        }
        const link = [...item.children].find(child => child.matches?.('a.md-nav__link'));
        if (!link || link.getAttribute('href')?.startsWith('#')) return;

        const key = pageKey(link);
        item.dataset.mlPage = key;
        item.dataset.mlPinned = String(state.pins.includes(key));
        item.hidden = state.pinnedOnly && !state.pins.includes(key);

        const pin = document.createElement('button');
        pin.type = 'button';
        pin.className = 'ml-sidebar-action ml-pin';
        const pageTitle = link.textContent.trim();
        const isPinned = state.pins.includes(key);
        pin.title = isPinned ? 'Unpin page' : 'Pin page';
        pin.setAttribute('aria-label', `${isPinned ? 'Unpin' : 'Pin'} ${pageTitle}`);
        pin.setAttribute('aria-pressed', String(state.pins.includes(key)));
        pin.innerHTML = icons.pin;
        pin.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          state.pins = state.pins.includes(key)
            ? state.pins.filter(pinKey => pinKey !== key)
            : [...state.pins, key];
          writeState(state);
          announce(`${pageTitle} ${state.pins.includes(key) ? 'pinned' : 'unpinned'}`);
          enhance();
        });

        const handle = document.createElement('button');
        handle.type = 'button';
        handle.className = 'ml-sidebar-action ml-drag';
        handle.title = 'Drag to reorder · Alt+↑/↓ also works';
        handle.setAttribute('aria-label', `Reorder ${pageTitle}. Use Alt and arrow keys, or drag.`);
        handle.innerHTML = icons.drag;
        handle.draggable = true;

        const controls = document.createElement('span');
        controls.className = 'ml-sidebar-controls';
        controls.append(pin, handle);
        item.append(controls);

        handle.addEventListener('dragstart', event => {
          item.classList.add('ml-dragging');
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', key);
        });
        handle.addEventListener('dragend', () => {
          item.classList.remove('ml-dragging');
          document.querySelectorAll('.ml-drop-before,.ml-drop-after').forEach(el =>
            el.classList.remove('ml-drop-before', 'ml-drop-after'));
        });
        handle.addEventListener('keydown', event => {
          if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
          event.preventDefault();
          const sibling = event.key === 'ArrowUp' ? item.previousElementSibling : item.nextElementSibling;
          if (!sibling?.dataset.mlPage) return;
          if (event.key === 'ArrowUp') list.insertBefore(item, sibling);
          else list.insertBefore(sibling, item);
          saveVisibleOrder(list, state);
          handle.focus();
          announce(`${pageTitle} moved ${event.key === 'ArrowUp' ? 'up' : 'down'}`);
        });
        item.addEventListener('dragover', event => {
          const source = list.querySelector('.ml-dragging');
          if (!source || source === item) return;
          event.preventDefault();
          const after = event.clientY > item.getBoundingClientRect().top + item.offsetHeight / 2;
          item.classList.toggle('ml-drop-before', !after);
          item.classList.toggle('ml-drop-after', after);
        });
        item.addEventListener('dragleave', () => item.classList.remove('ml-drop-before', 'ml-drop-after'));
        item.addEventListener('drop', event => {
          const source = list.querySelector('.ml-dragging');
          if (!source || source === item) return;
          event.preventDefault();
          const after = event.clientY > item.getBoundingClientRect().top + item.offsetHeight / 2;
          list.insertBefore(source, after ? item.nextSibling : item);
          item.classList.remove('ml-drop-before', 'ml-drop-after');
          saveVisibleOrder(list, state);
          announce('Sidebar order saved');
        });
      });
      sortList(list, state);
    });
  }

  if (typeof document$ !== 'undefined') document$.subscribe(enhance);
  else document.addEventListener('DOMContentLoaded', enhance);

  document.addEventListener('keydown', event => {
    if (!event.altKey || event.key.toLowerCase() !== 'p') return;
    const current = document.querySelector('.md-nav--primary a.md-nav__link--active');
    if (!current) return;
    event.preventDefault();
    const state = readState();
    const key = pageKey(current);
    state.pins = state.pins.includes(key) ? state.pins.filter(pin => pin !== key) : [...state.pins, key];
    writeState(state);
    announce(`Current page ${state.pins.includes(key) ? 'pinned' : 'unpinned'}`);
    enhance();
  });
})();
