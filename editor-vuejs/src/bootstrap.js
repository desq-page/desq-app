window.global ||= window;
document.body.innerHTML = '<img class="loading" src="/images/loading.svg" alt="Loading DESQ…" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)" />';
import('./main.js').then(module => module.appReady).catch(error => {
  console.error('Could not load DESQ', error);
  document.body.innerHTML = `
    <style>
      .bootstrap-error {
        position: fixed;
        inset: 0;
        overflow: auto;
        background: #fcfdf8;
        color: #172923;
        font: 16px/1.6 Inter, Helvetica, Arial, sans-serif;
      }
      .bootstrap-error .page-width {
        width: min(1240px, calc(100% - 96px));
        margin: 0 auto;
      }
      .bootstrap-error header {
        background: linear-gradient(90deg, rgba(218, 241, 225, .94), rgba(190, 230, 204, .80) 55%, rgba(209, 238, 219, .88)), url('/images/desq-hero.svg') center / cover no-repeat;
        border-bottom: 1px solid #bbd8c5;
      }
      .bootstrap-error .wordmark {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 80px;
        font-size: 28px;
        font-weight: 800;
        letter-spacing: -1.2px;
      }
      .bootstrap-error main {
        padding: 40px 0;
      }
      .bootstrap-error h1 {
        margin: 0;
        font-size: 28px;
      }
      .bootstrap-error button {
        padding: 8px 16px;
        border: 1px solid #172923;
        border-radius: 6px;
        background: #d7f46b;
        color: inherit;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }
      .bootstrap-error button:focus-visible {
        outline: 3px solid #598d24;
        outline-offset: 4px;
      }
      @media (max-width: 760px) {
        .bootstrap-error .wordmark { font-size: 24px; gap: 6px; }
      }
      @media (max-width: 680px) {
        .bootstrap-error .page-width { width: calc(100% - 32px); }
        .bootstrap-error .wordmark { min-height: 82px; }
      }
    </style>
    <div class="bootstrap-error">
      <header>
        <div class="page-width wordmark">
          <img src="/favicon.svg?v=desq-mark-v8" width="40" height="40" alt="" />
          DESQ
        </div>
      </header>
      <main class="page-width">
        <h1>DESQ could not load</h1>
        <p>The DESQ site may have been updated. Please reload the page.</p>
        <button type="button">Reload page</button>
      </main>
    </div>
  `;
  document.querySelector('.bootstrap-error button').addEventListener('click', () => window.location.reload());
});
