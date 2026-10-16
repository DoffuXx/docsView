(() => {
  const copyIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 21H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2m0-13H8v11h11V8M16 2H5a2 2 0 0 0-2 2v11h2V4h11V2Z"/></svg>';
  const pageKey = () => `markdownlive:markdown:${location.pathname}`;

  function readState() {
    try { return { tasks: {}, details: {}, code: {}, ...JSON.parse(localStorage.getItem(pageKey()) || '{}') }; }
    catch (_) { return { tasks: {}, details: {}, code: {} }; }
  }
  function writeState(state) { localStorage.setItem(pageKey(), JSON.stringify(state)); }

  function enhanceCode(state) {
    document.querySelectorAll('.md-content .highlight').forEach((block, index) => {
      if (block.dataset.mlCode) return;
      block.dataset.mlCode = String(index);
      const code = block.querySelector('code');
      const languageClass = [...(code?.classList || []), ...block.classList].find(name => name.startsWith('language-'));
      if (languageClass) {
        const badge = document.createElement('span');
        badge.className = 'ml-code-language';
        badge.textContent = languageClass.replace('language-', '');
        block.append(badge);
      }
      const lineCount = (code?.textContent.match(/\n/g)?.length || 0) + 1;
      if (lineCount <= 18) return;
      const id = String(index);
      const expanded = Boolean(state.code[id]);
      block.classList.toggle('ml-code-collapsed', !expanded);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ml-code-expand';
      button.textContent = expanded ? 'Collapse code' : `Show all ${lineCount} lines`;
      button.addEventListener('click', () => {
        const willExpand = block.classList.contains('ml-code-collapsed');
        block.classList.toggle('ml-code-collapsed', !willExpand);
        button.textContent = willExpand ? 'Collapse code' : `Show all ${lineCount} lines`;
        state.code[id] = willExpand;
        writeState(state);
      });
      block.append(button);
    });
  }

  function enhanceTables() {
    document.querySelectorAll('.md-content .md-typeset__table').forEach((wrapper, index) => {
      if (wrapper.querySelector('.ml-copy-table')) return;
      const table = wrapper.querySelector('table');
      if (!table) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ml-copy-table';
      button.textContent = 'Copy table';
      button.setAttribute('aria-label', `Copy table ${index + 1} as tab-separated text`);
      button.addEventListener('click', async () => {
        const text = [...table.rows].map(row => [...row.cells].map(cell => cell.innerText.trim()).join('\t')).join('\n');
        await navigator.clipboard.writeText(text);
        button.textContent = 'Copied';
        setTimeout(() => { button.textContent = 'Copy table'; }, 1200);
      });
      wrapper.append(button);
    });
  }

  function enhanceTasks(state) {
    document.querySelectorAll('.md-content .task-list-item input[type="checkbox"]').forEach((checkbox, index) => {
      checkbox.disabled = false;
      const id = String(index);
      if (Object.hasOwn(state.tasks, id)) checkbox.checked = state.tasks[id];
      if (checkbox.dataset.mlTask) return;
      checkbox.dataset.mlTask = id;
      checkbox.addEventListener('change', () => {
        state.tasks[id] = checkbox.checked;
        writeState(state);
      });
    });
  }

  function enhanceDetails(state) {
    document.querySelectorAll('.md-content details').forEach((details, index) => {
      const id = String(index);
      if (Object.hasOwn(state.details, id)) details.open = state.details[id];
      if (details.dataset.mlDetails) return;
      details.dataset.mlDetails = id;
      details.addEventListener('toggle', () => {
        state.details[id] = details.open;
        writeState(state);
      });
    });
  }

  function enhanceLinks() {
    document.querySelectorAll('.md-content a[href]').forEach(link => {
      const url = new URL(link.href, location.href);
      if (['http:', 'https:'].includes(url.protocol) && url.origin !== location.origin) {
        link.classList.add('ml-external');
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
    });
    document.querySelectorAll('.md-content .headerlink').forEach(link => {
      link.title = 'Copy link to this section';
      link.setAttribute('aria-label', 'Copy link to this section');
      if (link.dataset.mlHeading) return;
      link.dataset.mlHeading = 'true';
      link.addEventListener('click', event => {
        event.preventDefault();
        history.replaceState(null, '', link.hash);
        navigator.clipboard?.writeText(location.href);
        document.getElementById(decodeURIComponent(link.hash.slice(1)))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function enhanceTitle() {
    const source = document.querySelector('meta[name="markdown-source-file"]')?.content;
    const heading = document.querySelector('.md-content article > h1');
    if (!source || !heading || heading.closest('.ml-page-title-row')) return;
    const filename = source.split('/').pop();
    const row = document.createElement('div');
    row.className = 'ml-page-title-row';
    heading.before(row);
    row.append(heading);
    const actions = document.createElement('div');
    actions.className = 'ml-markdown-actions';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ml-copy-filename';
    button.title = `Copy ${filename}`;
    button.setAttribute('aria-label', `Copy filename ${filename}`);
    button.innerHTML = `${copyIcon}<span>${filename}</span>`;
    button.addEventListener('click', async () => {
      await navigator.clipboard.writeText(filename);
      const label = button.querySelector('span');
      label.textContent = 'Copied';
      setTimeout(() => { label.textContent = filename; }, 1200);
    });
    actions.append(button);

    const rawLink = document.querySelector('.md-content a[href*="_raw/"][href$=".md.txt"]');
    if (rawLink) {
      let rawMarkdown;
      const getRawMarkdown = async () => {
        if (rawMarkdown === undefined) rawMarkdown = await (await fetch(rawLink.href)).text();
        return rawMarkdown;
      };
      const copyMarkdown = document.createElement('button');
      copyMarkdown.type = 'button';
      copyMarkdown.className = 'ml-copy-filename';
      copyMarkdown.title = 'Copy raw Markdown';
      copyMarkdown.innerHTML = `${copyIcon}<span>Copy Markdown</span>`;
      copyMarkdown.addEventListener('click', async () => {
        await navigator.clipboard.writeText(await getRawMarkdown());
        const label = copyMarkdown.querySelector('span');
        label.textContent = 'Copied';
        setTimeout(() => { label.textContent = 'Copy Markdown'; }, 1200);
      });
      const download = document.createElement('a');
      download.className = 'ml-copy-filename';
      download.href = rawLink.href;
      download.download = filename;
      download.title = `Download ${filename}`;
      download.innerHTML = '<span>Download .md</span>';
      const source = document.createElement('button');
      source.type = 'button';
      source.className = 'ml-copy-filename';
      source.title = 'Toggle raw Markdown source';
      source.innerHTML = '<span>Source</span>';
      source.addEventListener('click', async () => {
        const article = heading.closest('article');
        let sourceView = article.querySelector(':scope > .ml-source-view');
        if (!sourceView) {
          sourceView = document.createElement('pre');
          sourceView.className = 'ml-source-view';
          sourceView.textContent = await getRawMarkdown();
          article.append(sourceView);
        }
        const enabled = article.classList.toggle('ml-source-mode');
        source.querySelector('span').textContent = enabled ? 'Rendered' : 'Source';
        source.setAttribute('aria-pressed', String(enabled));
      });
      actions.append(copyMarkdown, download, source);
    }
    row.append(actions);
  }

  function enhanceMarkdown() {
    const state = readState();
    enhanceCode(state);
    enhanceTables();
    enhanceTasks(state);
    enhanceDetails(state);
    enhanceLinks();
    enhanceTitle();
  }

  if (typeof document$ !== 'undefined') document$.subscribe(enhanceMarkdown);
  else document.addEventListener('DOMContentLoaded', enhanceMarkdown);
})();
