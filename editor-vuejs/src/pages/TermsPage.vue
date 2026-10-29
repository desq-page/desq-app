<template>
  <div class="terms-page">
    <a class="skip-link" href="#terms-content">Skip to content</a>
    <header class="site-header page-width">
      <RouterLink to="/" class="wordmark" aria-label="DESQ home">
        <img class="brand-symbol" src="/favicon.svg?v=desq-color" alt="" />
        DESQ
      </RouterLink>
      <nav aria-label="Main navigation">
        <RouterLink to="/?home=1">Back to home</RouterLink>
        <RouterLink to="/work" class="start-button">Workspace <span aria-hidden="true">↗</span></RouterLink>
      </nav>
    </header>

    <main id="terms-content" class="page-width">
      <div class="page-intro">
        <p class="eyebrow">DESQ</p>
        <h1>Terms &amp; <span>privacy.</span></h1>
        <p>The terms for using DESQ and our privacy policy.</p>
      </div>
      <article class="terms-card" aria-label="Terms of Service and Privacy Policy" v-html="termsContent"></article>
    </main>

    <footer class="site-footer page-width">
      <RouterLink to="/" class="footer-brand">DESQ</RouterLink>
      <p>Office documents, with a life on the web.</p>
      <RouterLink to="/work">Workspace</RouterLink>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { RouterLink } from "vue-router";
import termsHTML from "../content/terms.html?raw";

// The policy source is shared with the HTML page; this page supplies its styling.
const termsContent = termsHTML
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
  .replace(/<Header\s*\/>/gi, "")
  .replace(/<div class="mobile-fill">[\s\S]*?<\/div>/gi, "")
  .replace(/<div class="term-h2[^\"]*">([^<]*)<\/div>/g, "<h2>$1</h2>");

onMounted(() => { document.title = "Terms & Privacy — DESQ"; });
</script>

<style scoped>
.terms-page {
  width: 100vw;
  margin-left: calc(50% - 50vw);
  min-height: 100dvh;
  background: #fcfdf8;
  color: #172923;
  font-family: Inter, Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 1.7;
}
.page-width { width: min(1180px, calc(100% - 80px)); margin-inline: auto; }
a { color: inherit; text-decoration: none; }
a:focus-visible { outline: 2px solid #689533; outline-offset: 5px; }
.skip-link { position: absolute; left: 20px; top: -60px; padding: 8px 16px; background: #d7f46b; z-index: 10; }
.skip-link:focus { top: 10px; }
.site-header { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding-block: 28px; border-bottom: 1px solid #e3e8dc; }
.wordmark { display: inline-flex; align-items: center; gap: 10px; font-size: 27px; font-weight: 800; letter-spacing: -1.3px; }
.wordmark > span:last-child { margin-left: -10px; color: #689533; }
.brand-symbol { display: flex; align-items: flex-end; gap: 3px; width: 26px; height: 27px; }
.brand-symbol i { width: 6px; background: #172923; border-radius: 2px; transform: skewY(-18deg); }
.brand-symbol i:nth-child(1) { height: 14px; }
.brand-symbol i:nth-child(2) { height: 21px; }
.brand-symbol i:nth-child(3) { height: 27px; background: #89b843; }
nav { display: flex; align-items: center; gap: 28px; font-size: 14px; }
.start-button { display: inline-flex; align-items: center; gap: 20px; padding: 11px 18px; border-radius: 7px; background: #172923; color: white; font-weight: 700; }
.start-button:hover { background: #2e473b; }
.page-intro { max-width: 800px; margin: 68px auto 32px; }
.eyebrow { color: #63736b; font-size: 11px; font-weight: 700; letter-spacing: 2px; }
h1 { margin: 12px 0 16px; font-size: clamp(38px, 5vw, 58px); line-height: 1.12; letter-spacing: -2px; }
h1 span, .footer-brand span { color: #689533; }
.page-intro > p:last-child { color: #63736b; }
.terms-card { max-width: 800px; box-sizing: border-box; margin: 0 auto 80px; padding: 40px 44px; background: white; border: 1px solid #e3e8dc; border-radius: 16px; }
.terms-card :deep(h2) { font-size: 24px; letter-spacing: -.6px; line-height: 1.3; margin: 36px 0 18px; }
.terms-card :deep(h2:first-child) { margin-top: 0; }
.terms-card :deep(ul) { padding-left: 22px; margin: 0; }
.terms-card :deep(li) { color: #63736b; padding-left: 5px; margin-block: 14px; }
.terms-card :deep(li::marker) { color: #689533; }
.terms-card :deep(b) { color: #172923; font-weight: 600; }
.terms-card :deep(section + section) { margin-top: 44px; padding-top: 12px; border-top: 1px solid #e3e8dc; }
.terms-card :deep(h3) { margin: 26px 0 10px; font-size: 17px; line-height: 1.4; font-weight: 650; }
.terms-card :deep(p) { margin: 12px 0; color: #63736b; font-size: 15px; }
.terms-card :deep(.policy-date) { font-size: 12px; }
.terms-card :deep(a) { color: #689533; text-decoration: underline; text-underline-offset: 3px; }
.site-footer { display: flex; align-items: center; gap: 30px; padding-block: 28px; border-top: 1px solid #e3e8dc; color: #63736b; font-size: 13px; }
.footer-brand { color: #172923; font-size: 21px; font-weight: 800; letter-spacing: -1px; }
.site-footer > a:last-child { margin-left: auto; }
@media (max-width: 640px) {
  .page-width { width: calc(100% - 36px); }
  .site-header { flex-wrap: wrap; padding-block: 20px; }
  nav { gap: 18px; }
  .page-intro { margin-top: 40px; }
  .terms-card { padding: 24px; margin-bottom: 44px; }
  .site-footer { flex-wrap: wrap; gap: 12px 24px; }
  .site-footer p { width: 100%; order: 3; margin: 0; }
}
</style>
