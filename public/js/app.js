// THAKRUTHA (താക്കൃഥ) Main SPA Controller
(function() {
  document.addEventListener('DOMContentLoaded', () => {
    fetchStats();
    setupNavScroll();
    setupMobileDrawer();
  });

  async function fetchStats() {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();

      const el = document.getElementById('ticketsRemainingPercentage');
      if (el) {
        el.textContent = `${data.remainingPercentage}%`;
      }
    } catch (err) {
      console.warn('Could not load stats:', err);
    }
  }

  function setupMobileDrawer() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileDrawer = document.getElementById('mobileDrawer');
    const closeMobileDrawerBtn = document.getElementById('closeMobileDrawerBtn');

    mobileMenuBtn?.addEventListener('click', () => {
      mobileDrawer?.classList.add('active');
    });

    closeMobileDrawerBtn?.addEventListener('click', () => {
      mobileDrawer?.classList.remove('active');
    });

    document.querySelectorAll('.mobile-drawer-link').forEach(link => {
      link.addEventListener('click', () => {
        mobileDrawer?.classList.remove('active');
      });
    });
  }

  function setupNavScroll() {
    const links = document.querySelectorAll('.nav-link');
    window.addEventListener('scroll', () => {
      let fromTop = window.scrollY + 120;
      links.forEach(link => {
        const section = document.querySelector(link.hash);
        if (section) {
          if (
            section.offsetTop <= fromTop &&
            section.offsetTop + section.offsetHeight > fromTop
          ) {
            link.classList.add('active');
          } else {
            link.classList.remove('active');
          }
        }
      });
    });
  }

  window.fetchStats = fetchStats;
})();
