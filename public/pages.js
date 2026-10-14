(() => {
  const PROGRESS_STORAGE_KEY = '__BQM_PROGRESS_KEY__';
  function activeProgressKey() {
    // In built GitHub Pages assets the placeholder is replaced with a per-chain,
    // per-proxy key. Local Vite development can use the actual Play-page pointer.
    if (!PROGRESS_STORAGE_KEY.startsWith('__BQM_')) return PROGRESS_STORAGE_KEY;
    try {
      const pointer = JSON.parse(window.localStorage?.getItem('bqm_fixed_current_progress_pointer') || 'null');
      if (/^bqmFixed(?:968|677)_(?:0x[0-9a-f]{40}|practice)_ProgressV1$/.test(pointer?.key || '')) {
        return pointer.key;
      }
    } catch { /* browser storage disabled or invalid */ }
    return 'bqmFixed968_practice_ProgressV1';
  }
  const MAX_MILESTONE = 12;

  function readProgress() {
    try {
      const raw = window.localStorage?.getItem(activeProgressKey());
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function shortAddress(address) {
    const value = String(address || '');
    return value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
  }

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach((el) => { el.textContent = value; });
  }

  function formatRetry(until) {
    const seconds = Math.max(0, Math.ceil((Number(until || 0) - Date.now()) / 1000));
    if (!seconds) return 'Ready';
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }

  function renderProgress() {
    const progress = readProgress();
    if (!progress) {
      setText('[data-progress-account]', 'Not synced yet');
      setText('[data-progress-highest]', '0 / 12');
      setText('[data-progress-best]', '0');
      setText('[data-progress-retry]', 'Ready');
      setText('[data-progress-updated]', 'Open Play and connect a wallet to sync progress.');
      return;
    }

    const highest = Math.max(0, Math.min(MAX_MILESTONE, Math.floor(Number(progress.highestMilestone) || 0)));
    const minted = new Set(
      Array.isArray(progress.mintedMilestones)
        ? progress.mintedMilestones.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= MAX_MILESTONE)
        : []
    );

    setText('[data-progress-account]', progress.account ? shortAddress(progress.account) : 'Not connected');
    setText('[data-progress-highest]', `${highest} / ${MAX_MILESTONE}`);
    setText('[data-progress-best]', Number(progress.bestScore || 0).toLocaleString());
    setText('[data-progress-retry]', formatRetry(progress.retryLockedUntil));
    setText(
      '[data-progress-updated]',
      progress.syncedAt ? `Last synced ${new Date(progress.syncedAt).toLocaleString()}` : 'Last synced state unavailable.'
    );

    const percent = (highest / MAX_MILESTONE) * 100;
    document.querySelectorAll('[data-xp-bar]').forEach((el) => { el.style.width = `${percent}%`; });
    document.querySelectorAll('.page-progress[role="progressbar"]').forEach((el) => { el.setAttribute('aria-valuenow', String(highest)); });
    setText('[data-xp-label]', `${highest} of ${MAX_MILESTONE} protocol milestones minted`);

    document.querySelectorAll('[data-milestone]').forEach((card) => {
      const milestone = Number(card.dataset.milestone || 0);
      const status = card.querySelector('[data-nft-status]');
      const isMinted = minted.has(milestone) || milestone <= highest;
      const isNext = milestone === highest + 1;
      card.classList.toggle('is-minted', isMinted);
      card.classList.toggle('is-next', !isMinted && isNext);
      if (status) status.textContent = isMinted ? 'Minted' : (isNext ? 'Next' : 'Locked');
    });
  }

  const menu = document.querySelector('.page-menu');
  const toggle = document.querySelector('.page-menu-toggle');
  if (menu && toggle) {
    const drawer = menu.querySelector('.page-drawer');
    if (drawer) {
      drawer.id ||= 'page-navigation';
      toggle.setAttribute('aria-controls', drawer.id);
    }

    const setOpen = (open) => {
      menu.classList.toggle('open', Boolean(open));
      toggle.setAttribute('aria-expanded', String(Boolean(open)));
    };

    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      setOpen(!menu.classList.contains('open'));
    });

    document.addEventListener('pointerdown', (event) => {
      if (!menu.contains(event.target)) setOpen(false);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') setOpen(false);
    });

    const current = location.pathname.split('/').pop() || 'home.html';
    document.querySelectorAll('.page-drawer a').forEach((link) => {
      const target = (link.getAttribute('href') || '').split('/').pop();
      if (target === current) link.setAttribute('aria-current', 'page');
    });
  }

  renderProgress();
  window.setInterval(() => {
    if (document.querySelector('[data-progress-retry]')) renderProgress();
  }, 1000);
})();
