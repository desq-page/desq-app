<script setup lang="ts">
import { onMounted } from "vue";

onMounted(() => {
  document.title = "DESQ — HTML Presentation Editor & Powerpoint to HTML";
  let keywords = document.querySelector<HTMLMetaElement>('meta[name="keywords"]');
  if (!keywords) {
    keywords = document.createElement("meta");
    keywords.name = "keywords";
    document.head.appendChild(keywords);
  }
  keywords.content = "HTML presentation editor, Office document editor, Word to HTML, Publisher to HTML, PowerPoint to HTML, convert PPTX to HTML, export PowerPoint to HTML, Office to HTML, slide sharing, embed presentations, interactive slides, presentation animation, Powerpoint games, slide design, PowerPoint editor, editable HTML slides, offline presentations, AI presentation editor";
});

const features = [
  { symbol: "◴", name: "Charts & SmartArt", description: "Bring your data and diagrams with you. Keep charts, SmartArt, tables, and shapes part of the presentation." },
  { symbol: "✳", name: "Animations & interactions", description: "Build a story one click at a time. Preserve object animations, timing, and interactive slide content." },
  { symbol: "⇢", name: "Morph & transitions", description: "Keep the movement between your slides, from subtle transitions to expressive PowerPoint Morph effects." },
  { symbol: "♫", name: "Sound & video", description: "Let your presentation speak. Keep audio, video, and media together with your slides in a single HTML file." },
  { symbol: "▤", name: "Master Slides", description: "Edit with structure. Preserve slide masters and reusable layouts through your PowerPoint round trip." },
  { symbol: "◈", name: "Corporate themes", description: "Stay on brand. Carry your corporate theme, colors, typography, and slide layouts into every presentation." },
];

const questions = [
  { title: "How do I convert PowerPoint to HTML?", answer: "Open your PowerPoint (.pptx) presentation in DESQ, edit it in your browser, and save it as a self-contained HTML file. The slides, media, viewer, and editor travel together, ready to share or embed on a website." },
  { title: "Can I edit my presentation and save it back to PPTX?", answer: "Yes. DESQ supports full PowerPoint round-trip editability: load PPTX, edit your slides, and save as PPTX again. Master Slides, corporate themes, charts, SmartArt, animations, sound, and Morph transitions stay part of your presentation." },
  { title: "Can I work offline and keep my files private?", answer: "Yes. Your HTML presentation includes its editor and viewer, so you can open and edit it offline in a browser. Local editing keeps files on your device. You choose when to share a file or use a connected AI service." },
  { title: "Can I create presentations using AI agents?", answer: "Yes. DESQ is designed to work with AI agents to create and edit presentations in HTML. Work with an agent, refine your slides in the browser, and save the result as HTML or an editable PowerPoint file." },
  { title: "Is DESQ an alternative to SlideShare?", answer: "For sharing and embedding presentations, DESQ offers a portable HTML workflow. Export PowerPoint to HTML and share the file directly or embed it on your own website, with animations, interactions, and an editor included." },
  { title: "Can I import Word or Publisher files too?", answer: "Yes. Alongside PowerPoint presentations, DESQ supports importing Microsoft Word (.docx) and Publisher (.pub) files. Convert Office content to editable HTML and work with it in your browser." },
];
</script>

<template>
  <div class="desq-home">
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header page-width">
      <a href="/" class="wordmark" aria-label="DESQ home"><img src="/favicon.svg?v=desq-mark-v8" alt="" />DESQ</a>
      <nav aria-label="Main navigation">
        <a href="https://github.com/desq-page/desq-app" target="_blank" class="nav-detail">Github</a>
        <a href="/work" class="button button-dark">Workspace <span aria-hidden="true">↗</span></a>
      </nav>
    </header>

    <main id="main">
      <section class="hero-shell" aria-labelledby="hero-title">
        <div class="page-width hero">
          <div class="hero-stage">
            <div class="hero-copy">
              <p class="eyebrow">THE FULL-FLEDGED AI SLIDE EDITOR</p>
              <h1 id="hero-title">Your next design <br/>is in a <em>slide</em>.</h1>
              <p class="hero-description">Import and edit designs as slides, with interactivity and layout intact. Create beautiful slides in NotebookLM or other AI tools and make their images editable. Use AI to create games and turn them into controllable slide animations.  Save your work as a single HTML file for easy distribution. All with the familiar features of a presentation editor.</p>
              <div class="hero-actions">
                <a href="/work" class="button button-lime">Create now<span aria-hidden="true">↗</span></a>
                <a href="#features" class="text-link">Explore the features <span aria-hidden="true">↓</span></a>
              </div>
              <p class="hero-note"><span aria-hidden="true">✓</span> Free to edit. Works offline in browser. Your files stay private</p>
            </div>

            <figure class="hero-workflow">
              <img src="/images/desq-workflow.svg" alt="PowerPoint, Publisher, Word, PDF, ChatGPT, Gemini Notebook, and HTML feed into the DESQ slide editor, shown with slide thumbnails, an editable canvas, and formatting tools." width="600" height="422" />
            </figure>
          </div>
        </div>
      </section>

      <section id="features" class="features-section page-width" aria-labelledby="features-title">
        <div class="section-intro">
          <div><p class="eyebrow">NO COMPROMISE. FULL SLIDE POWER</p><h2 id="features-title">Everything that makes<br />a slide, <em>a slide.</em></h2></div>
          <p>Edit presentations and other Office documents in your browser, with the visuals, interactions, and transitions that bring slides to life.</p>
        </div>
        <div class="feature-grid">
          <article v-for="feature in features" :key="feature.name" class="feature-card">
            <span class="feature-symbol" aria-hidden="true">{{ feature.symbol }}</span>
            <h3>{{ feature.name }}</h3><p>{{ feature.description }}</p>
          </article>
        </div>
      </section>
    </main>

    <footer class="site-footer page-width"><a href="/" class="wordmark">DESQ</a><p>Office documents, with a life on the web.</p><nav aria-label="Footer navigation"><a href="/work">Workspace</a><a href="/terms">Terms</a><a href="/support">Support</a><a href="https://github.com/desq-page/desq-app" target="_blank" rel="noopener noreferrer">GitHub</a></nav></footer>
  </div>
</template>

<style scoped>
.desq-home { --ink: #19352a; --muted: #5b6c62; --green: #315b3f; --lime: #d0ec9c; --line: #dce3d8; background: #fafbf6; color: var(--ink); font-family: Inter, Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.6; width: 100%; overflow: clip; }
.desq-home *, .desq-home *::before, .desq-home *::after { box-sizing: border-box; }
.desq-home a { color: inherit; text-decoration: none; }
a:focus-visible, input:focus-visible, summary:focus-visible { outline: 3px solid #7ca141; outline-offset: 5px; }
.page-width { width: min(1240px, calc(100% - 80px)); margin-inline: auto; }
.skip-link { position: absolute; top: -100px; left: 20px; z-index: 10; padding: 12px; background: white; }
.skip-link:focus { top: 12px; }
.site-header { display: flex; align-items: center; justify-content: space-between; min-height: 80px; gap: 24px; }
.wordmark { display: inline-flex; align-items: center; gap: 9px; font-size: 27px; font-weight: 800; letter-spacing: -1.2px; }
.wordmark img { width: 40px; height: 40px; }
.site-header nav { display: flex; align-items: center; gap: 28px; font-size: 12px; font-weight: 650; }
.button { display: inline-flex; align-items: center; justify-content: space-between; gap: 22px; border-radius: 5px; padding: 14px 20px; font-size: 13px; font-weight: 750; line-height: 1.45; transition: background .2s, transform .2s; }
.button:hover { transform: translateY(-2px); }
.desq-home .button-dark { background: #245439; color: #fffdf5; }
.desq-home .button-lime { background: var(--lime); color: #245439; }
.button-lime:hover { background: #e0f5b9; }
.desq-home .hero-actions .button-lime { background: #245439; color: #fffdf5; }
.desq-home .hero-actions .button-lime:hover { background: #193b2b; }
.text-link { font-size: 13px; font-weight: 650; }
.text-link span { margin-left: 8px; }
.text-link:hover, .site-footer a:hover { text-decoration: underline; text-underline-offset: 4px; }
.eyebrow { margin: 0 0 16px; font-size: 10px; font-weight: 750; letter-spacing: .15em; color: var(--green); }
h1, h2, h3, p { overflow-wrap: break-word; }
h1, h2, h3 { text-wrap: balance; }
h2 { margin: 0; font-size: clamp(28px,3vw,40px); font-weight: 650; line-height: 1.16; letter-spacing: -.045em; }
h2 em { font: inherit; color: #648044; }
.hero-shell { color: #193b2b; background: linear-gradient(90deg, rgba(244,248,235,.95), rgba(235,243,220,.88) 48%, rgba(235,243,220,.55)), url('/images/desq-hero.svg') center / cover no-repeat; }
/* Place the tree near the right edge of the hero landscape. */
@media (min-width: 1100px) {
  .hero-shell { background-size: cover, 112% auto; background-position: center, left -80px; }
  .hero .hero-stage { gap: 32px; }
  .hero .hero-description { max-width: 550px; }

}
.hero { padding-block: 36px 32px; }
.hero-stage { display: grid; grid-template-columns: minmax(0,1.08fr) minmax(0,1fr); align-items: center; gap: 56px; }
.hero .eyebrow { color: #3f6332; margin-bottom: 20px; }
h1 { margin: 0; font-size: clamp(40px,4.4vw,60px); font-weight: 650; line-height: 1.08; letter-spacing: -.055em; }
h1 em { font-style: normal; color: #496f34; }
.hero-description { max-width: 490px; margin: 22px 0 0; color: #3d5641; font-size: 16px; line-height: 1.7; }
.hero-workflow { width: 100%; margin: 0; }
.hero-workflow img { display: block; width: 100%; height: auto; }
.hero-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 20px; margin-top: 26px; }
.hero-note { margin: 17px 0 0; font-size: 11px; color: #425e43; }
.hero-note > span { color: #496f34; margin-right: 4px; }
.demo-section { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); align-items: start; gap: 48px; margin-top: 48px; }
.demo-title { margin: 0; font-size: clamp(32px, 4vw, 48px); }
.presentation-preview { width: min(100%, 760px); min-width: 0; margin: 0 auto; padding: 14px; border: 1px solid #f3f9e933; border-radius: 10px; background: #f4f6eb; color: #294331; box-shadow: 0 22px 50px #031c2840; }
.hero-stage { column-gap: 64px; }

.preview-toolbar, .preview-bottom, .preview-formats { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 10px; }
.preview-toolbar { margin-bottom: 12px; font-size: 11px; font-weight: 600; }
.file-icon { margin-right: 6px; font-size: 18px; vertical-align: middle; }
.file-badge { font-size: 8px; letter-spacing: .06em; color: #5c7052; }
.sample-player { display: block; width: 100%; aspect-ratio: 16 / 9; border: 0; border-radius: 4px; background: #0d3b36; }
.sample-caption { margin-top: 14px; font-size: 12px; line-height: 1.65; color: #3d5641; }
.sample-caption a { color: #245439; font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
.sample-caption a:hover { color: #193b2b; }
.hero-values { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 16px; margin-top: 38px; scroll-margin-top: 24px; }
.hero-values article { padding: 20px 22px; border: 1px solid #b8caa7; border-radius: 6px; background: #f7faefed; }
.value-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #49623f; font-size: 9px; letter-spacing: .1em; font-weight: 700; }
.value-symbol { font-size: 24px; line-height: 1; color: #496f34; }
.hero-values h2 { margin: 14px 0 10px; font-size: clamp(20px,1.8vw,24px); letter-spacing: -.035em; }
.hero-values p { margin: 0; font-size: 13px; line-height: 1.65; color: #42583e; }
.features-section, .ownership-section { padding-block: 36px; scroll-margin-top: 30px; }
.section-intro { display: flex; align-items: end; justify-content: space-between; gap: 50px; margin-bottom: 36px; }
.section-intro > p { max-width: 335px; margin: 0; color: var(--muted); font-size: 14px; }
.feature-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 0 36px; }
.feature-card { padding: 26px 0; border-top: 1px solid var(--line); }
.feature-symbol { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 8px; background: #e9efdd; color: #57723a; font-size: 24px; }
.feature-card h3 { margin: 16px 0 8px; font-size: 19px; line-height: 1.25; letter-spacing: -.025em; }
.feature-card p { margin: 0; color: var(--muted); font-size: 13px; }
.ownership-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
.ownership-card { display: flex; flex-direction: column; padding: 32px; background: #f0f3e9; border: 1px solid var(--line); border-radius: 8px; }
.ownership-label { font-size: 9px; font-weight: 700; color: #65804a; letter-spacing: .12em; }
.ownership-card h3 { margin: 16px 0 12px; font-size: 26px; line-height: 1.15; letter-spacing: -.035em; }
.ownership-card > p { margin: 0 0 28px; color: var(--muted); font-size: 14px; }
.file-contents { margin-top: auto; padding: 20px; border: 1px solid #cdd9bf; background: #fafcf5; border-radius: 6px; }
.file-contents > b { font: 500 14px/1.5 ui-monospace, monospace; }
.file-contents > div { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.file-contents span { font-size: 11px; padding: 4px 10px; background: #eaf0df; border-radius: 3px; }
.agent-card { background: #193b2b; color: #f1f7e8; border-color: #193b2b; }
.agent-card .ownership-label { color: #bad78f; }
.agent-card > p { color: #cbdac2; }
.agent-flow { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: auto; }
.agent-flow span { padding: 10px 12px; border: 1px solid #a6c58855; border-radius: 5px; font-size: 11px; }
.agent-flow b { color: #b9d891; font-weight: 400; }
.agent-card .privacy-note { margin: 18px 0 0; font-size: 10px; color: #a9bda0; }
.other-formats { display: flex; justify-content: space-between; align-items: center; gap: 40px; padding-block: 28px; border-block: 1px solid var(--line); }
.other-formats .eyebrow { margin-bottom: 8px; }
.other-formats h2 { font-size: 24px; }
.other-formats p:not(.eyebrow) { margin: 10px 0 0; font-size: 13px; color: var(--muted); max-width: 490px; }
.format-links { display: flex; gap: 24px; flex-shrink: 0; }
.format-links a { display: flex; flex-direction: column; align-items: start; gap: 7px; font-size: 11px; }
.format-links b { padding: 4px 8px; background: #eaf0e1; color: #4d6d39; border-radius: 3px; font-size: 10px; }
.format-links a:hover > span { text-decoration: underline; }
.faq-section { display: grid; grid-template-columns: .8fr 1.2fr; gap: 80px; padding-block: 76px; }
.faq-section > div > p:not(.eyebrow) { font-size: 14px; color: var(--muted); max-width: 280px; }
.faq-list details { border-bottom: 1px solid var(--line); }
.faq-list details:first-child { border-top: 1px solid var(--line); }
.faq-list summary { display: flex; justify-content: space-between; align-items: center; gap: 20px; padding: 20px 0; list-style: none; cursor: pointer; font-size: 14px; font-weight: 650; line-height: 1.5; }
.faq-list summary::-webkit-details-marker { display: none; }
.faq-list summary > span { color: #79905d; font-size: 22px; font-weight: 400; }
.faq-list details[open] summary > span { transform: rotate(45deg); }
.faq-list details p { margin: 0 0 22px; color: var(--muted); font-size: 13px; }
.cta-section { background: #193b2b; color: #f5f8ef; }
.cta-inner { display: flex; align-items: center; justify-content: space-between; gap: 40px; padding-block: 54px; }
.cta-section .eyebrow { color: #b8d88f; }
.cta-section h2 { font-size: clamp(28px,3vw,38px); }
.cta-actions { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.cta-actions > span { font-size: 10px; color: #bbceb0; }
.site-footer { display: flex; align-items: center; flex-wrap: wrap; gap: 24px; padding-block: 30px; }
.site-footer .wordmark { font-size: 23px; }
.site-footer p { flex: 1; margin: 0; font-size: 11px; color: var(--muted); }
.site-footer nav { display: flex; flex-wrap: wrap; gap: 22px; font-size: 12px; }
@media (min-width: 1100px) and (max-height: 800px) { .hero { padding-top: 28px; } .hero-values { margin-top: 30px; } .hero-values article { padding-block: 18px; } }
@media (max-width: 1100px) { .hero-stage { gap: 32px; } .hero-actions { gap: 14px; } .hero-values article { padding: 18px; } .hero-values h2 { font-size: 21px; } .faq-section { gap: 40px; } .other-formats { gap: 24px; } }
@media (max-width: 760px) { .page-width { width: calc(100% - 40px); } .site-header { min-height: 72px; gap: 16px; } .site-header .nav-detail { display: none; } .site-header .button { font-size: 11px; padding: 11px 14px; gap: 12px; } .wordmark { font-size: 24px; } .wordmark img { width: 29px; height: 29px; } .hero { padding-block: 34px 24px; } .hero-stage { grid-template-columns: 1fr; gap: 32px; } h1 { font-size: clamp(38px,7.5vw,56px); } .hero-description { font-size: 15px; max-width: 540px; } .hero-note { font-size: 10px; } .demo-section { grid-template-columns: 1fr; gap: 24px; margin-top: 40px; } .presentation-preview { width: 100%; } .hero-values { grid-template-columns: 1fr; margin-top: 32px; gap: 12px; } .hero-values h2 { font-size: 23px; margin-top: 10px; } .features-section, .ownership-section { padding-block: 48px; } .section-intro { flex-direction: column; align-items: start; gap: 18px; margin-bottom: 26px; } .section-intro > p { max-width: 500px; } .feature-grid { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 0 24px; } .ownership-grid { grid-template-columns: 1fr; gap: 16px; } .ownership-card { padding: 26px; } .other-formats { flex-direction: column; align-items: start; gap: 24px; } .format-links { gap: 40px; } .faq-section { grid-template-columns: 1fr; gap: 24px; padding-block: 48px; } .faq-section > div > p:not(.eyebrow) { max-width: none; } .cta-inner { flex-direction: column; align-items: start; padding-block: 40px; gap: 26px; } .cta-actions { align-items: start; } .site-footer { gap: 16px; } .site-footer p { flex-basis: 60%; } }
@media (max-width: 420px) { .hero-actions { align-items: start; flex-direction: column; gap: 16px; } .eyebrow { font-size: 9px; } .feature-grid { grid-template-columns: 1fr; } .feature-card { padding-block: 22px; } .file-badge { font-size: 6px; } .preview-formats { font-size: 8px; } .preview-formats b { font-size: 9px; } .ownership-card { padding: 22px; } .agent-flow { gap: 6px; } .agent-flow span { padding: 8px; font-size: 10px; } }
@media (prefers-reduced-motion: reduce) { .preview-slide *, .button { animation: none; transition: none; } .motion-toggle { display: none; } }
</style>
