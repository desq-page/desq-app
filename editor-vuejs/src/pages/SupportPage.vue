<script setup lang="ts">
import { onMounted } from "vue";
import { RouterLink } from "vue-router";

onMounted(() => { document.title = "Support — DESQ"; });
</script>

<template>
  <div class="support-page">
    <a class="skip-link" href="#support-content">Skip to content</a>
    <header class="site-header page-width">
      <RouterLink to="/" class="wordmark" aria-label="DESQ home"><img src="/favicon.svg?v=desq-color" alt="" />DESQ</RouterLink>
      <nav aria-label="Main navigation">
        <RouterLink to="/?home=1">Back to home</RouterLink>
        <RouterLink to="/work" class="start-button">Workspace <span aria-hidden="true">↗</span></RouterLink>
      </nav>
    </header>

    <main id="support-content" class="page-width">
      <div class="page-intro">
        <p class="eyebrow">DESQ SUPPORT</p>
        <h1>Help us improve <span>your documents.</span></h1>
      </div>
      <article class="support-card">
        <h2>Bug reports</h2>
        <p>We work to reproduce your documents as accurately as they appear in Microsoft Office. Office files can contain complex features, so some content may not look exactly the same in DESQ.</p>
        <p>If you find an inaccurate representation, contact our support team. We’ll investigate and try to fix it.</p>
        <div class="contact-links">
          <a href="https://github.com/desq-page/desq-app" target="_blank" rel="noopener noreferrer">Report a bug on GitHub <span aria-hidden="true">↗</span></a>
        </div>
      </article>
      <!-- <article class="support-card">
        <h2>Acknowledgements</h2>
        <p>DESQ uses open-source projects and includes code inspired by or locally modified from their original implementations. We acknowledge these projects and their contributors:</p>
        <div class="contact-links">
          <a href="https://github.com/asleepattheterminal/pubbridge" target="_blank" rel="noopener noreferrer">PubBridge <span aria-hidden="true">↗</span></a>
          <a href="https://github.com/meshesha/PPTXjs" target="_blank" rel="noopener noreferrer">PPTXjs <span aria-hidden="true">↗</span></a>
        </div>
        <div class="contact-links">
          <a href="/NOTICE.txt" target="_blank" rel="noopener noreferrer">NOTICES <span aria-hidden="true">↗</span></a>
        </div>
      </article> -->
    </main>

    <footer class="site-footer page-width">
      <span>DESQ — The complete presentation editor in HTML.</span>
      <RouterLink to="/work">Workspace</RouterLink>
      <RouterLink to="/terms">Terms</RouterLink>
    </footer>
  </div>
</template>

<style scoped>
.support-page { width: 100vw; margin-left: calc(50% - 50vw); min-height: 100dvh; display: flex; flex-direction: column; background: #fcfdf8; color: #172923; font-family: Inter, Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.7; }
.page-width { width: min(1180px, calc(100% - 80px)); margin-inline: auto; }
a { color: inherit; text-decoration: none; }
a:focus-visible { outline: 2px solid #689533; outline-offset: 5px; }
.skip-link { position: absolute; left: 20px; top: -60px; padding: 8px 16px; background: #d7f46b; z-index: 10; }
.skip-link:focus { top: 10px; }
.site-header { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding-block: 28px; border-bottom: 1px solid #e3e8dc; }
.wordmark { display: inline-flex; align-items: center; gap: 9px; font-size: 27px; font-weight: 800; letter-spacing: -1.3px; }
.wordmark img { width: 34px; height: 34px; flex-shrink: 0; }
.wordmark span, h1 span { color: #689533; }
nav { display: flex; align-items: center; gap: 28px; font-size: 14px; }
.start-button { padding: 12px 20px; background: #172923; color: white; border-radius: 7px; font-weight: 600; }
.start-button:hover { background: #2e473b; }
main { flex: 1; }
.page-intro { max-width: 800px; margin: 68px auto 32px; }
.eyebrow { color: #63736b; font-size: 11px; font-weight: 700; letter-spacing: 2px; }
h1 { margin: 12px 0 16px; font-size: clamp(38px, 5vw, 58px); line-height: 1.12; letter-spacing: -2px; }
.support-card { max-width: 800px; box-sizing: border-box; margin: 0 auto 80px; padding: 40px 44px; background: white; border: 1px solid #e3e8dc; border-radius: 16px; }
h2 { margin: 0 0 18px; font-size: 24px; letter-spacing: -.6px; }
.support-card p { color: #63736b; }
.contact-links { display: flex; flex-wrap: wrap; gap: 14px 28px; margin-top: 28px; }
.contact-links a { color: #526740; font-weight: 600; text-decoration: underline; text-underline-offset: 4px; overflow-wrap: anywhere; }
.site-footer { display: flex; align-items: center; flex-wrap: wrap; gap: 24px; padding-block: 28px; border-top: 1px solid #e3e8dc; color: #63736b; font-size: 13px; }
.site-footer > span { margin-right: auto; }
@media (max-width: 640px) { .page-width { width: calc(100% - 36px); } .site-header { flex-wrap: wrap; padding-block: 20px; } nav { gap: 18px; } .page-intro { margin-top: 40px; } .support-card { padding: 24px; margin-bottom: 44px; } .contact-links { flex-direction: column; } .site-footer > span { width: 100%; } }
</style>
