window.global ||= window;
document.body.innerHTML = '<img class="loading" src="/images/loading.svg" alt="Loading DESQ…" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)" />';
import('./main.js').then(module => module.appReady).catch(error => {
  console.error('Could not load DESQ', error);
  document.body.innerHTML = '<p style="font-family:sans-serif;padding:2rem">DESQ could not load. <a href="">Try again</a>.</p>';
});
