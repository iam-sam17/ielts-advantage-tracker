/* ==========================================================================
   IELTS ADVANTAGE VAULT - MULTI-PAGE CONTROLLER & ENGINE
   Dynamic Data Binding, Live Search, Player Modal, Bookmarks, LocalStorage
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Determine active page module from body data attribute
  const pageCategory = document.body.dataset.pageCategory || 'home';

  // State
  let currentCategory = pageCategory;
  let currentFilter = 'all'; // 'all', 'unwatched', 'watched', 'pdf', 'starred'
  let currentSort = 'default';
  let searchQuery = '';

  // Check URL query parameters (e.g. ?filter=starred or ?q=search)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('filter')) {
    currentFilter = urlParams.get('filter');
  }
  if (urlParams.get('q')) {
    searchQuery = urlParams.get('q');
  }

  // Storage Keys
  const STORAGE_WATCHED = 'ielts_vault_watched_v1';
  const STORAGE_BOOKMARKS = 'ielts_vault_bookmarks_v1';

  let watchedVideos = new Set(JSON.parse(localStorage.getItem(STORAGE_WATCHED) || '[]'));
  let bookmarkedVideos = new Set(JSON.parse(localStorage.getItem(STORAGE_BOOKMARKS) || '[]'));

  // Elements
  const videoGrid = document.getElementById('video-grid');
  const emptyState = document.getElementById('empty-state');
  const globalSearch = document.getElementById('global-search');
  const clearSearch = document.getElementById('clear-search');
  const filterPills = document.querySelectorAll('.filter-pill');
  const sortSelect = document.getElementById('sort-select');
  const bookmarkFilterBtn = document.getElementById('bookmark-filter-btn');
  const resetFilterBtn = document.getElementById('reset-filter-btn');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const appSidebar = document.getElementById('app-sidebar');

  // Stats Elements
  const progressText = document.getElementById('progress-text');
  const progressFill = document.getElementById('progress-fill');
  const bookmarkCount = document.getElementById('bookmark-count');

  // Banner Elements
  const bannerTag = document.getElementById('banner-tag');
  const bannerHeading = document.getElementById('banner-heading');
  const bannerDesc = document.getElementById('banner-desc');

  // Modal Elements
  const videoModal = document.getElementById('video-modal');
  const modalIframe = document.getElementById('modal-iframe');
  const modalTitle = document.getElementById('modal-title');
  const modalCategory = document.getElementById('modal-category');
  const modalClose = document.getElementById('modal-close');
  const modalWatchedBtn = document.getElementById('modal-watched-btn');
  const modalStarBtn = document.getElementById('modal-star-btn');
  const modalYtLink = document.getElementById('modal-yt-link');

  let activeModalVid = null;

  // Category Map helper
  const catMap = {};
  if (typeof VAULT_DATA !== 'undefined' && VAULT_DATA.categories) {
    VAULT_DATA.categories.forEach(c => {
      catMap[c.key] = c;
    });
  }

  // Page URL Map for Navigation
  const pageUrlMap = {
    'home': 'index.html',
    'all': 'all-videos.html',
    'speaking': 'speaking.html',
    'writing_task1': 'writing-task-1.html',
    'writing_task2': 'writing-task-2.html',
    'reading': 'reading.html',
    'listening': 'listening.html',
    'vocabulary': 'vocabulary.html',
    'general_tips': 'master-strategy.html',
    'vip_reviews': 'success-stories.html'
  };

  // ── Render Category Counts ──────────────────────────────────────────────
  function updateSidebarCounts() {
    if (typeof VAULT_DATA === 'undefined') return;

    const counts = { all: VAULT_DATA.videos.length };
    VAULT_DATA.categories.forEach(c => counts[c.key] = 0);

    VAULT_DATA.videos.forEach(v => {
      if (counts[v.category] !== undefined) {
        counts[v.category]++;
      }
    });

    Object.keys(counts).forEach(k => {
      const el = document.getElementById(`count-${k}`);
      if (el) el.textContent = counts[k];
    });
  }

  // ── Update Progress Stats ───────────────────────────────────────────────
  function updateProgress() {
    if (typeof VAULT_DATA === 'undefined') return;

    const total = VAULT_DATA.videos.length;
    const watched = watchedVideos.size;
    const percent = total > 0 ? Math.round((watched / total) * 100) : 0;

    if (progressText) progressText.textContent = `${watched} Watched (${percent}%)`;
    if (progressFill) progressFill.style.width = `${percent}%`;
    if (bookmarkCount) bookmarkCount.textContent = bookmarkedVideos.size;
  }

  // ── Filter & Sort Videos ────────────────────────────────────────────────
  function getFilteredVideos() {
    if (typeof VAULT_DATA === 'undefined') return [];

    let list = VAULT_DATA.videos.filter(v => {
      // 1. Category Filter
      if (currentCategory !== 'all' && currentCategory !== 'home' && v.category !== currentCategory) {
        return false;
      }

      // 2. Status Filter
      if (currentFilter === 'unwatched' && watchedVideos.has(v.id)) return false;
      if (currentFilter === 'watched' && !watchedVideos.has(v.id)) return false;
      if (currentFilter === 'pdf' && !v.hasPdf) return false;
      if (currentFilter === 'starred' && !bookmarkedVideos.has(v.id)) return false;

      // 3. Search Query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const inTitle = v.title.toLowerCase().includes(q);
        const inId = v.id.toLowerCase().includes(q);
        const inCat = (catMap[v.category]?.label || '').toLowerCase().includes(q);
        if (!inTitle && !inId && !inCat) return false;
      }

      return true;
    });

    // Sort
    if (currentSort === 'title_asc') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (currentSort === 'title_desc') {
      list.sort((a, b) => b.title.localeCompare(a.title));
    }

    return list;
  }

  // ── Render Cards ────────────────────────────────────────────────────────
  function renderVideos() {
    if (!videoGrid) return;

    const videos = getFilteredVideos();

    if (videos.length === 0) {
      videoGrid.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    videoGrid.innerHTML = videos.map(v => {
      const isWatched = watchedVideos.has(v.id);
      const isStarred = bookmarkedVideos.has(v.id);
      const cat = catMap[v.category] || { label: 'General', icon: '💡', folder: 'General' };
      const thumbUrl = `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`;

      return `
        <article class="video-card ${isWatched ? 'watched' : ''}" data-id="${v.id}">
          <div class="card-thumbnail-wrap" onclick="window.vaultApp.openPlayer('${v.id}')">
            <img src="${thumbUrl}" alt="${v.title}" class="card-thumb" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=60'">
            <div class="play-overlay">
              <div class="play-badge">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              </div>
            </div>
            <div class="card-tags">
              <span class="card-category-tag">${cat.icon} ${cat.folder}</span>
              <div class="card-tags-right">
                ${v.hasPdf ? '<span class="pdf-badge">PDF NOTES</span>' : ''}
                ${v.duration ? `<span class="duration-badge">${v.duration}</span>` : ''}
              </div>
            </div>
          </div>

          <div class="card-body">
            <h4 class="card-title" onclick="window.vaultApp.openPlayer('${v.id}')" title="${v.title}">
              ${v.title}
            </h4>

            <div class="card-meta">
              <span class="card-id-code">[${v.id}]</span>
              <div class="card-actions">
                <button class="card-action-btn ${isWatched ? 'watched-active' : ''}" title="${isWatched ? 'Mark as unwatched' : 'Mark as watched'}" onclick="window.vaultApp.toggleWatched('${v.id}')">
                  ${isWatched ? '✅' : '⚪'}
                </button>
                <button class="card-action-btn ${isStarred ? 'starred-active' : ''}" title="${isStarred ? 'Remove bookmark' : 'Bookmark this video'}" onclick="window.vaultApp.toggleBookmark('${v.id}')">
                  ${isStarred ? '⭐' : '☆'}
                </button>
              </div>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  // ── Render Welcome Modules (Home Page) ──────────────────────────────────
  function renderWelcomeModules() {
    const grid = document.getElementById('modules-grid');
    if (!grid || typeof VAULT_DATA === 'undefined') return;

    grid.innerHTML = VAULT_DATA.categories.map(cat => {
      let count = 0;
      VAULT_DATA.videos.forEach(v => {
        if (v.category === cat.key) count++;
      });

      const targetUrl = pageUrlMap[cat.key] || 'all-videos.html';

      return `
        <a href="${targetUrl}" class="module-card" style="text-decoration: none; color: inherit; display: flex; flex-direction: column;">
          <div class="module-icon-wrap">${cat.icon}</div>
          <h3 class="module-title">${cat.folder}</h3>
          <p class="module-desc">${cat.description || ''}</p>
          <div style="margin-top: auto; padding-top: 15px; display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <span style="color: var(--accent-primary); font-size: 13px; font-weight: 700;">Explore Page →</span>
            <span class="welcome-module-count">${count} Videos</span>
          </div>
        </a>
      `;
    }).join('');
  }

  // ── Update Banner Content ───────────────────────────────────────────────
  function updateBanner() {
    if (!bannerTag || !bannerHeading || !bannerDesc) return;

    if (currentFilter === 'starred') {
      bannerTag.textContent = 'SAVED FAVORITES';
      bannerHeading.textContent = `Bookmarked Videos (${bookmarkedVideos.size})`;
      bannerDesc.textContent = 'Your curated collection of important IELTS Advantage strategies and lectures.';
      return;
    }

    if (currentCategory === 'all') {
      bannerTag.textContent = 'EXPLORING ALL MODULES';
      bannerHeading.textContent = 'All Masterclasses';
      bannerDesc.textContent = 'Complete index of high-yield strategy sessions, full multi-hour crash courses, band score breakdowns, and mock exams.';
    } else if (catMap[currentCategory]) {
      const cat = catMap[currentCategory];
      bannerTag.textContent = `${cat.icon} DEDICATED MODULE`;
      bannerHeading.textContent = cat.label;
      bannerDesc.textContent = cat.description;
    }
  }

  // ── Global App Actions ──────────────────────────────────────────────────
  window.vaultApp = {
    openPlayer(vidId) {
      if (typeof VAULT_DATA === 'undefined') return;
      const video = VAULT_DATA.videos.find(v => v.id === vidId);
      if (!video) return;
      // Navigate to dedicated player page
      window.location.href = `player.html?v=${vidId}`;
    },

    closePlayer() {
      // No-op — player is now a separate page
    },

    updateModalButtons() {
      // No-op — modal is now a separate page
    },

    toggleWatched(vidId) {
      if (watchedVideos.has(vidId)) {
        watchedVideos.delete(vidId);
      } else {
        watchedVideos.add(vidId);
      }
      localStorage.setItem(STORAGE_WATCHED, JSON.stringify(Array.from(watchedVideos)));
      updateProgress();
      renderVideos();
    },

    toggleBookmark(vidId) {
      if (bookmarkedVideos.has(vidId)) {
        bookmarkedVideos.delete(vidId);
      } else {
        bookmarkedVideos.add(vidId);
      }
      localStorage.setItem(STORAGE_BOOKMARKS, JSON.stringify(Array.from(bookmarkedVideos)));
      updateProgress();
      renderVideos();
    }
  };

  // ── Event Listeners ─────────────────────────────────────────────────────

  // Search input
  if (globalSearch) {
    if (searchQuery) {
      globalSearch.value = searchQuery;
      if (clearSearch) clearSearch.style.display = 'block';
    }

    globalSearch.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      if (clearSearch) clearSearch.style.display = searchQuery ? 'block' : 'none';
      
      // If we are on home page and user starts typing, redirect to all-videos.html with query
      if (pageCategory === 'home' && searchQuery) {
        window.location.href = `all-videos.html?q=${encodeURIComponent(searchQuery)}`;
        return;
      }

      renderVideos();
    });
  }

  if (clearSearch) {
    clearSearch.addEventListener('click', () => {
      if (globalSearch) globalSearch.value = '';
      searchQuery = '';
      clearSearch.style.display = 'none';
      renderVideos();
    });
  }

  // Global Keyboard Shortcuts (Ctrl+K, '/', Escape)
  document.addEventListener('keydown', (e) => {
    const isCtrlK = (e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K');
    const isSlash = e.key === '/' && document.activeElement !== globalSearch;

    if (isCtrlK || isSlash) {
      e.preventDefault();
      if (globalSearch) {
        globalSearch.focus();
        globalSearch.select();
      }
    }

    if (e.key === 'Escape') {
      if (videoModal && videoModal.style.display === 'flex') {
        window.vaultApp.closePlayer();
      } else if (globalSearch && document.activeElement === globalSearch) {
        globalSearch.blur();
      }
    }
  });

  // Filter pills
  filterPills.forEach(pill => {
    if (pill.dataset.filter === currentFilter) {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
    }

    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentFilter = pill.dataset.filter;
      renderVideos();
    });
  });

  // Bookmark filter button in top nav
  if (bookmarkFilterBtn) {
    if (currentFilter === 'starred') {
      bookmarkFilterBtn.classList.add('active');
    }

    bookmarkFilterBtn.addEventListener('click', () => {
      if (pageCategory === 'home') {
        window.location.href = 'all-videos.html?filter=starred';
        return;
      }

      bookmarkFilterBtn.classList.toggle('active');

      if (bookmarkFilterBtn.classList.contains('active')) {
        currentFilter = 'starred';
      } else {
        currentFilter = 'all';
        const defaultPill = document.querySelector('.filter-pill[data-filter="all"]');
        if (defaultPill) {
          filterPills.forEach(p => p.classList.remove('active'));
          defaultPill.classList.add('active');
        }
      }

      updateBanner();
      renderVideos();
    });
  }

  // Sort dropdown
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      renderVideos();
    });
  }

  // Reset filters button
  if (resetFilterBtn) {
    resetFilterBtn.addEventListener('click', () => {
      currentFilter = 'all';
      searchQuery = '';
      if (globalSearch) globalSearch.value = '';
      if (clearSearch) clearSearch.style.display = 'none';
      if (sortSelect) sortSelect.value = 'default';
      currentSort = 'default';

      filterPills.forEach(p => p.classList.remove('active'));
      document.querySelector('.filter-pill[data-filter="all"]')?.classList.add('active');
      if (bookmarkFilterBtn) bookmarkFilterBtn.classList.remove('active');

      updateBanner();
      renderVideos();
    });
  }

  // Sidebar toggle & Mobile Backdrop handling
  let backdrop = document.querySelector('.sidebar-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    document.body.appendChild(backdrop);
  }

  function closeSidebar() {
    if (appSidebar) {
      appSidebar.classList.remove('open');
      appSidebar.classList.add('hidden');
    }
    if (backdrop) backdrop.classList.remove('active');
  }

  function toggleSidebar() {
    if (!appSidebar) return;
    const isOpen = appSidebar.classList.contains('open');
    if (isOpen) {
      closeSidebar();
    } else {
      appSidebar.classList.remove('hidden');
      appSidebar.classList.add('open');
      if (window.innerWidth <= 900 && backdrop) {
        backdrop.classList.add('active');
      }
    }
  }

  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSidebar();
    });
  }

  if (backdrop) {
    backdrop.addEventListener('click', () => {
      closeSidebar();
    });
  }

  // Close sidebar on link click on mobile
  if (appSidebar) {
    appSidebar.querySelectorAll('.sidebar-nav a').forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 900) {
          closeSidebar();
        }
      });
    });
  }

  // Modal interactions (no-op — player is now a separate page)


  // Theme logic
  const themeSelect = document.getElementById('theme-select');
  const savedTheme = localStorage.getItem('ielts_vault_theme_v1') || 'fmhy';
  
  if (themeSelect) {
    themeSelect.value = savedTheme;
    document.documentElement.setAttribute('data-theme', savedTheme);

    themeSelect.addEventListener('change', (e) => {
      const newTheme = e.target.value;
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('ielts_vault_theme_v1', newTheme);
    });
  }

  // Initialize Page
  updateSidebarCounts();
  updateProgress();
  
  if (pageCategory === 'home') {
    renderWelcomeModules();
  } else {
    updateBanner();
    renderVideos();
  }
});
