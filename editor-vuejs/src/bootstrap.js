// The landing page is already HTML and CSS. Background prefetch warms the HTTP
// cache without executing app modules or applying editor styles.
const landingPage = ['/', '/index.html'].includes(window.location.pathname);
if (!landingPage) {
  window.global ||= window;
  document.getElementById('static-home-style')?.remove();
  document.body.innerHTML = '<img class="loading" src="/images/loading.svg" alt="Loading DESQ…" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)" />';
  document.title = 'DESQ';
  import('./main.js').then(module => module.appReady).catch(error => {
    console.error('Could not load DESQ', error);
    document.body.innerHTML = '<p style="font-family:sans-serif;padding:2rem">DESQ could not load. <a href="">Try again</a>.</p>';
  });
} else {
  const preloadDashboard = async () => {
    if (navigator.connection?.saveData) return;
    try {
      const files = import.meta.env.PROD
        ? await fetch('/dashboard-preload.json', { priority: 'low' }).then(response => {
          if (!response.ok) throw new Error('Dashboard preload manifest unavailable');
          return response.json();
        })
        : ['/src/main.js', '/src/pages/DashboardWorkspace.vue', '/src/pages/DashboardPage.vue'];
      for (const file of files) {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = new URL(file, window.location.origin + '/').href;
        link.as = file.endsWith('.css') ? 'style' : 'script';
        link.crossOrigin = 'anonymous';
        link.fetchPriority = 'low';
        document.head.appendChild(link);
      }
    } catch {
      // Prefetch is optional; app navigation loads the same files normally.
    }
  };
  const schedulePreload = () => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(preloadDashboard);
    else window.setTimeout(preloadDashboard, 1000);
  };
  if (document.readyState === 'complete') schedulePreload();
  else window.addEventListener('load', schedulePreload, { once: true });
}
