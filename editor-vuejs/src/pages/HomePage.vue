<script setup lang="ts">
import { onMounted } from "vue";

onMounted(() => {
  document.title = "DESQ — HTML Presentation Editor & PowerPoint to HTML";
  let keywords = document.querySelector<HTMLMetaElement>('meta[name="keywords"]');
  if (!keywords) {
    keywords = document.createElement("meta");
    keywords.name = "keywords";
    document.head.appendChild(keywords);
  }
  keywords.content = "HTML presentation editor, PowerPoint to HTML, convert PPTX to HTML, export PowerPoint to HTML, Office to HTML, slide sharing, embed presentations, interactive slides, presentation animation, slide design, PowerPoint editor, editable HTML slides, offline presentations, AI presentation editor";
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
  <div class="savanna-home">
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header page-width">
      <a href="/" class="wordmark" aria-label="DESQ home"><img src="/favicon.svg?v=desq-color" alt="" />DESQ</a>
      <nav aria-label="Main navigation">
        <a class="nav-detail" href="#features">Features</a>
        <a class="nav-detail" href="#powerpoint">PowerPoint compatibility</a>
        <a href="/work" class="button button-dark">Workspace <span aria-hidden="true">↗</span></a>
      </nav>
    </header>

    <main id="main">
      <section class="hero-shell" aria-labelledby="hero-title">
        <div class="page-width hero">
          <div class="hero-stage">
            <div class="hero-copy">
              <p class="eyebrow">THE COMPLETE PRESENTATION EDITOR</p>
              <h1 id="hero-title">Presentations,<br /><em>made for HTML.</em></h1>
              <p class="hero-description">All the power of PowerPoint. All the freedom of the web. Create, edit, and present in HTML. Convert PPTX privately on your device. And save as single HTML with your editor and viewer built in.</p>
              <div class="hero-actions">
                <a href="/work" class="button button-lime">Create a presentation <span aria-hidden="true">↗</span></a>
                <a href="#features" class="text-link">Explore the features <span aria-hidden="true">↓</span></a>
              </div>
              <p class="hero-note"><span aria-hidden="true">✓</span> Just a browser. Works offline. Your files stay private.</p>
            </div>

            <div class="presentation-preview" role="group" aria-label="Animated presentation design preview">
              <div class="preview-toolbar"><span><span class="file-icon" aria-hidden="true">▱</span> possibilities.html</span><span class="file-badge">ONE FILE. ALL INSIDE.</span></div>
              <div class="preview-slide">
                <div class="slide-photo" aria-hidden="true"></div>
                <div class="slide-content"><span class="slide-eyebrow">A LITTLE ROOM FOR BIG IDEAS</span><p><span class="slide-word">Let</span> <span class="slide-word">your</span><br /><span class="slide-word">ideas</span> <span class="slide-word"><em>move.</em></span></p><span class="slide-rule" aria-hidden="true"></span><span class="slide-footer">DESQ STUDIO <span>01 / 03</span></span></div>
                <div class="orbit orbit-one" aria-hidden="true"></div><div class="orbit orbit-two" aria-hidden="true"></div>
              </div>
              <div class="preview-bottom"><span><i aria-hidden="true"></i> HTML animation study</span><label class="motion-toggle"><input type="checkbox" aria-label="Pause preview animation" /><span>Pause animation</span></label></div>
              <div class="preview-formats"><span>Slides + media + viewer + editor</span><b>HTML <span aria-hidden="true">⇄</span> PPTX</b></div>
            </div>
          </div>

          <div id="why-savanna" class="hero-values" aria-label="Why DESQ">
            <article>
              <div class="value-top"><span>01 / PRESENT IN HTML</span><span class="value-symbol" aria-hidden="true">↗</span></div>
              <h2>Completely in HTML.</h2>
              <p>Editor and viewer, right in your browser. One private, offline file to edit, share, embed, or publish online. Designed to work with AI agents.</p>
            </article>
            <article>
              <div class="value-top"><span>02 / EVERY FEATURE</span><span class="value-symbol" aria-hidden="true">✳</span></div>
              <h2>Made to move.</h2>
              <p>All PowerPoint features preserved: charts, SmartArt, animations, sound, video, and Morph. Interactive slides that stay alive.</p>
            </article>
            <article>
              <div class="value-top"><span>03 / FULL ROUND TRIP</span><span class="value-symbol" aria-hidden="true">⇄</span></div>
              <h2>PowerPoint, both ways.</h2>
              <p>Load PPTX. Edit every detail. Save as PPTX. Full editability, with your Master Slides and corporate themes intact.</p>
            </article>
          </div>
        </div>
      </section>

      <section id="features" class="features-section page-width" aria-labelledby="features-title">
        <div class="section-intro">
          <div><p class="eyebrow">FULL PRESENTATION POWER</p><h2 id="features-title">Everything that makes<br />a presentation, <em>a presentation.</em></h2></div>
          <p>A full-featured HTML presentation editor. Every visual, every interaction, every transition—ready to edit and present in your browser.</p>
        </div>
        <div class="feature-grid">
          <article v-for="feature in features" :key="feature.name" class="feature-card">
            <span class="feature-symbol" aria-hidden="true">{{ feature.symbol }}</span>
            <h3>{{ feature.name }}</h3><p>{{ feature.description }}</p>
          </article>
        </div>
      </section>

      <section id="powerpoint" class="roundtrip-section" aria-labelledby="roundtrip-title">
        <div class="page-width roundtrip-inner">
          <div class="roundtrip-copy"><p class="eyebrow">POWERPOINT IN. POWERPOINT OUT.</p><h2 id="roundtrip-title">A new way to work.<br />A familiar way back.</h2><p>Your deck stays editable through the entire journey. Load a PowerPoint file, make it your own in DESQ, and save it back as PPTX whenever your team needs it.</p><a href="/work" class="text-link">Open your presentation <span aria-hidden="true">↗</span></a></div>
          <div class="roundtrip-flow" aria-label="Load PPTX, edit and present in HTML, save as PPTX">
            <div class="flow-step"><span class="format-icon pptx-icon">P</span><div><span class="step-label">01 / LOAD</span><h3>Your PowerPoint.</h3><p>Bring your existing .pptx deck.</p></div></div>
            <span class="flow-connector" aria-hidden="true">↕</span>
            <div class="flow-step flow-html"><span class="format-icon html-icon">&lt;/&gt;</span><div><span class="step-label">02 / CREATE</span><h3>Your browser.</h3><p>Edit, animate, present. Save as HTML.</p></div></div>
            <span class="flow-connector" aria-hidden="true">↕</span>
            <div class="flow-step"><span class="format-icon pptx-icon">P</span><div><span class="step-label">03 / SAVE</span><h3>Back to PowerPoint.</h3><p>Editable PPTX. Masters and themes included.</p></div></div>
          </div>
        </div>
      </section>

      <section class="ownership-section page-width" aria-labelledby="ownership-title">
        <div class="section-intro"><div><p class="eyebrow">YOUR PRESENTATION. YOUR POSSIBILITIES.</p><h2 id="ownership-title">Your presentation. Your way.</h2></div><p>One HTML file gives your presentation a life beyond any single app.</p></div>
        <div class="ownership-grid">
          <article class="ownership-card"><span class="ownership-label">01 / TAKE IT ANYWHERE</span><h3>The file is the workspace.</h3><p>Your slides, media, viewer, and editor live together. Open and edit offline, keep files private on your device, or share and embed your presentation when you're ready.</p><div class="file-contents" aria-label="One HTML file contains slides, media, viewer, and editor"><b>presentation.html</b><div><span>Slides</span><span>Media</span><span>Viewer</span><span>Editor</span></div></div></article>
          <article class="ownership-card agent-card"><span class="ownership-label">02 / CREATE WITH AI AGENTS</span><h3>Open for a new way to create.</h3><p>DESQ is designed to work with AI agents. Create and edit presentations together, then refine every detail in your browser. Keep the result as HTML or take it back to PowerPoint.</p><div class="agent-flow" aria-label="AI agent and browser editor work with the same presentation"><span>AI agent</span><b aria-hidden="true">⇄</b><span>Your presentation</span><b aria-hidden="true">⇄</b><span>You</span></div><p class="privacy-note">Local editing stays on your device. You choose when to use a connected AI service.</p></article>
        </div>
      </section>

      <section id="products" class="other-formats page-width" aria-labelledby="formats-title">
        <div><p class="eyebrow">BEYOND PRESENTATIONS</p><h2 id="formats-title">More of your Office files, welcome.</h2><p>Also import Microsoft Publisher and Word files, and convert Office content to editable HTML.</p></div>
        <div class="format-links"><a href="/work"><b>PUB</b><span>Microsoft Publisher <span aria-hidden="true">↗</span></span></a><a href="/work"><b>DOCX</b><span>Microsoft Word <span aria-hidden="true">↗</span></span></a></div>
      </section>

      <section class="faq-section page-width" aria-labelledby="faq-title">
        <div><p class="eyebrow">A FEW MORE DETAILS</p><h2 id="faq-title">From PowerPoint<br />to the open web.</h2><p>Convert PowerPoint to HTML, share your slides, and keep creating.</p></div>
        <div class="faq-list"><details v-for="question in questions" :key="question.title"><summary>{{ question.title }}<span aria-hidden="true">+</span></summary><p>{{ question.answer }}</p></details></div>
      </section>

      <section class="cta-section" aria-labelledby="cta-title"><div class="page-width cta-inner"><div><p class="eyebrow">EVERY FEATURE. ONE HTML FILE.</p><h2 id="cta-title">Your next great presentation<br />starts in your browser.</h2></div><div class="cta-actions"><a href="/work" class="button button-lime">Create a presentation <span aria-hidden="true">↗</span></a><span>No installation. No account required to edit.</span></div></div></section>
    </main>

    <footer class="site-footer page-width"><a href="/" class="wordmark">DESQ</a><p>The complete presentation editor in HTML.</p><nav aria-label="Footer navigation"><a href="/work">Workspace</a><a href="/terms">Terms</a><a href="/support">Support</a></nav></footer>
  </div>
</template>

<style scoped>
.savanna-home { --ink: #19352a; --muted: #5b6c62; --green: #315b3f; --lime: #d0ec9c; --line: #dce3d8; background: #fafbf6; color: var(--ink); font-family: Inter, Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.6; width: 100%; overflow: clip; }
.savanna-home *, .savanna-home *::before, .savanna-home *::after { box-sizing: border-box; }
.savanna-home a { color: inherit; text-decoration: none; }
a:focus-visible, input:focus-visible, summary:focus-visible { outline: 3px solid #7ca141; outline-offset: 5px; }
.page-width { width: min(1240px, calc(100% - 80px)); margin-inline: auto; }
.skip-link { position: absolute; top: -100px; left: 20px; z-index: 10; padding: 12px; background: white; }
.skip-link:focus { top: 12px; }
.site-header { display: flex; align-items: center; justify-content: space-between; min-height: 80px; gap: 24px; }
.wordmark { display: inline-flex; align-items: center; gap: 9px; font-size: 27px; font-weight: 800; letter-spacing: -1.2px; }
.wordmark img { width: 34px; height: 34px; }
.site-header nav { display: flex; align-items: center; gap: 28px; font-size: 12px; font-weight: 650; }
.button { display: inline-flex; align-items: center; justify-content: space-between; gap: 22px; border-radius: 5px; padding: 14px 20px; font-size: 13px; font-weight: 750; line-height: 1.45; transition: background .2s, transform .2s; }
.button:hover { transform: translateY(-2px); }
.savanna-home .button-dark { background: var(--ink); color: #fff; }
.savanna-home .button-lime { background: var(--lime); color: #173323; }
.button-lime:hover { background: #e0f5b9; }
.text-link { font-size: 13px; font-weight: 650; }
.text-link span { margin-left: 8px; }
.text-link:hover, .site-footer a:hover { text-decoration: underline; text-underline-offset: 4px; }
.eyebrow { margin: 0 0 16px; font-size: 10px; font-weight: 750; letter-spacing: .15em; color: var(--green); }
h1, h2, h3, p { overflow-wrap: break-word; }
h1, h2, h3 { text-wrap: balance; }
h2 { margin: 0; font-size: clamp(28px,3vw,40px); font-weight: 650; line-height: 1.16; letter-spacing: -.045em; }
h2 em { font: inherit; color: #648044; }
.hero-shell { color: #fff; background: linear-gradient(90deg, rgba(9,32,17,.68), rgba(9,32,17,.42) 48%, rgba(9,32,17,.10)), url('/images/desq-hero.svg') center / cover no-repeat; }
/* Place the tree near the right edge of the hero landscape. */
@media (min-width: 1100px) {
  .hero-shell { background-size: cover, 112% auto; background-position: center, left -80px; }
  .hero .hero-stage { gap: 32px; }
  .hero .hero-description { max-width: 550px; }
  .hero-stage .presentation-preview { width: 100%; max-width: 520px; justify-self: end; }
}
.hero { padding-block: 36px 32px; }
.hero-stage { display: grid; grid-template-columns: minmax(0,1.08fr) minmax(0,1fr); align-items: center; gap: 56px; }
.hero .eyebrow { color: var(--lime); margin-bottom: 20px; }
h1 { margin: 0; font-size: clamp(40px,4.4vw,60px); font-weight: 650; line-height: 1.08; letter-spacing: -.055em; }
h1 em { font-style: normal; color: var(--lime); }
.hero-description { max-width: 490px; margin: 22px 0 0; color: #dee7da; font-size: 16px; line-height: 1.7; }
.hero-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 20px; margin-top: 26px; }
.hero-note { margin: 17px 0 0; font-size: 11px; color: #c3d3bb; }
.hero-note > span { color: var(--lime); margin-right: 4px; }
.presentation-preview { width: 100%; max-width: 480px; justify-self: end; min-width: 0; padding: 14px; border: 1px solid #f3f9e933; border-radius: 10px; background: #f4f6eb; color: #294331; box-shadow: 0 22px 50px #031c2840; transform: rotate(1deg); }
.preview-toolbar, .preview-bottom, .preview-formats { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 10px; }
.preview-toolbar { margin-bottom: 12px; font-size: 11px; font-weight: 600; }
.file-icon { margin-right: 6px; font-size: 18px; vertical-align: middle; }
.file-badge { font-size: 8px; letter-spacing: .06em; color: #5c7052; }
.preview-slide { position: relative; aspect-ratio: 16 / 9; isolation: isolate; overflow: hidden; border-radius: 4px; background: #dfebc9; }
.slide-photo { position: absolute; z-index: -1; inset: 0 0 0 54%; background: linear-gradient(0deg,#163b2744,#163b2711), url('/images/desq-hero.svg') right center / cover; animation: slide-morph 12s ease-in-out infinite; }
.slide-content { padding: 6%; position: relative; z-index: 2; height: 100%; }
.slide-eyebrow { display: block; font-size: clamp(6px,.6vw,9px); letter-spacing: .12em; font-weight: 700; }
.slide-content > p { margin: 9% 0 0; font: 500 clamp(26px,3.5vw,46px)/1.03 Georgia, serif; letter-spacing: -.055em; }
.slide-content em { color: #477042; }
.slide-word { display: inline-block; animation: word-reveal 12s ease-in-out .6s infinite both; }
.slide-word:nth-child(2) { animation-delay: .85s; }
.slide-word:nth-child(4) { animation-delay: 1.1s; }
.slide-word:nth-child(5) { animation-delay: 1.35s; }
.slide-rule { display: block; width: 35px; height: 2px; background: #527b43; margin-top: 6%; }
.slide-footer { position: absolute; left: 6%; right: 6%; bottom: 6%; display: flex; justify-content: space-between; font-size: 7px; letter-spacing: .08em; font-weight: 700; }
.slide-footer > span { color: white; }
.orbit { position: absolute; z-index: 1; width: 25%; aspect-ratio: 1; right: 10%; top: 20%; border: 1px solid #e6f6c5aa; border-radius: 50%; animation: orbit-drift 12s ease-in-out infinite; }
.orbit-two { width: 33%; right: 6%; top: 13%; animation-direction: reverse; }
.preview-bottom { padding-top: 12px; color: #607253; font-size: 9px; }
.preview-bottom i { display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: #6d9144; margin-right: 4px; }
.motion-toggle { display: flex; align-items: center; gap: 4px; cursor: pointer; }
.motion-toggle input { accent-color: #315e32; width: 12px; height: 12px; margin: 0; }
.presentation-preview:has(input:checked) .preview-slide * { animation-play-state: paused; }
.preview-formats { margin-top: 12px; padding-top: 11px; border-top: 1px solid #d8e0ce; font-size: 9px; }
.preview-formats b { font-size: 10px; }
.preview-formats b span { margin-inline: 5px; color: #7b9258; }
.hero-values { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 16px; margin-top: 38px; scroll-margin-top: 24px; }
.hero-values article { padding: 20px 22px; border: 1px solid #cce0b92e; border-radius: 6px; background: #12311fe6; }
.value-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #c0d2a8; font-size: 9px; letter-spacing: .1em; font-weight: 700; }
.value-symbol { font-size: 24px; line-height: 1; color: var(--lime); }
.hero-values h2 { margin: 14px 0 10px; font-size: clamp(20px,1.8vw,24px); letter-spacing: -.035em; }
.hero-values p { margin: 0; font-size: 13px; line-height: 1.65; color: #d5e0ce; }
.features-section, .ownership-section { padding-block: 76px; scroll-margin-top: 30px; }
.section-intro { display: flex; align-items: end; justify-content: space-between; gap: 50px; margin-bottom: 36px; }
.section-intro > p { max-width: 335px; margin: 0; color: var(--muted); font-size: 14px; }
.feature-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 0 36px; }
.feature-card { padding: 26px 0; border-top: 1px solid var(--line); }
.feature-symbol { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 8px; background: #e9efdd; color: #57723a; font-size: 24px; }
.feature-card h3 { margin: 16px 0 8px; font-size: 19px; line-height: 1.25; letter-spacing: -.025em; }
.feature-card p { margin: 0; color: var(--muted); font-size: 13px; }
.roundtrip-section { background: #eaf0e1; scroll-margin-top: 0; }
.roundtrip-inner { display: grid; grid-template-columns: 1fr 1fr; gap: 100px; align-items: center; padding-block: 60px; }
.roundtrip-copy > p:not(.eyebrow) { max-width: 430px; margin: 22px 0; color: var(--muted); font-size: 15px; }
.roundtrip-flow { padding: 28px; background: #f9fbf5; border: 1px solid #d7e1ce; border-radius: 10px; }
.flow-step { display: flex; align-items: center; gap: 18px; }
.format-icon { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 50px; height: 58px; border-radius: 5px 14px 5px 5px; font-size: 24px; font-weight: 700; }
.pptx-icon { background: #f8e7de; color: #ac5335; }
.html-icon { background: #ddeaC5; color: #426332; font-size: 18px; }
.step-label { font-size: 9px; letter-spacing: .12em; color: #6b7c5a; font-weight: 750; }
.flow-step h3 { margin: 2px 0; font-size: 18px; letter-spacing: -.025em; }
.flow-step p { margin: 0; color: var(--muted); font-size: 12px; }
.flow-connector { display: block; padding: 5px 0; width: 50px; text-align: center; color: #849772; font-size: 23px; }
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
.site-footer nav { display: flex; gap: 22px; font-size: 12px; }
@keyframes slide-morph { 0%, 15%, 85%, 100% { border-radius: 0; transform: translateX(0); } 40%, 60% { border-radius: 45% 0 0 45%; transform: translateX(5%); } }
@keyframes orbit-drift { 0%, 15%, 85%, 100% { transform: translateY(0) scale(1); } 40%, 60% { transform: translateY(24%) scale(.8); } }
@keyframes word-reveal { 0%, 100% { opacity: 0; transform: translateY(10px); } 5%, 90% { opacity: 1; transform: translateY(0); } 95% { opacity: 0; transform: translateY(-6px); } }
@media (min-width: 1100px) and (max-height: 800px) { .hero { padding-top: 28px; } .hero-values { margin-top: 30px; } .hero-values article { padding-block: 18px; } }
@media (max-width: 1100px) { .hero-stage { gap: 32px; } .hero-actions { gap: 14px; } .hero-values article { padding: 18px; } .hero-values h2 { font-size: 21px; } .roundtrip-inner { gap: 50px; } .faq-section { gap: 40px; } .other-formats { gap: 24px; } }
@media (max-width: 760px) { .page-width { width: calc(100% - 40px); } .site-header { min-height: 72px; gap: 16px; } .site-header .nav-detail { display: none; } .site-header .button { font-size: 11px; padding: 11px 14px; gap: 12px; } .wordmark { font-size: 24px; } .wordmark img { width: 29px; height: 29px; } .hero { padding-block: 34px 24px; } .hero-stage { grid-template-columns: 1fr; gap: 32px; } h1 { font-size: clamp(38px,7.5vw,56px); } .hero-description { font-size: 15px; max-width: 540px; } .hero-note { font-size: 10px; } .presentation-preview { width: min(100%,520px); justify-self: center; } .slide-content > p { font-size: clamp(28px,7vw,45px); } .slide-eyebrow { font-size: 7px; } .hero-values { grid-template-columns: 1fr; margin-top: 32px; gap: 12px; } .hero-values h2 { font-size: 23px; margin-top: 10px; } .features-section, .ownership-section { padding-block: 48px; } .section-intro { flex-direction: column; align-items: start; gap: 18px; margin-bottom: 26px; } .section-intro > p { max-width: 500px; } .feature-grid { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 0 24px; } .roundtrip-inner { grid-template-columns: 1fr; gap: 28px; padding-block: 40px; } .roundtrip-copy > p:not(.eyebrow) { max-width: none; } .ownership-grid { grid-template-columns: 1fr; gap: 16px; } .ownership-card { padding: 26px; } .other-formats { flex-direction: column; align-items: start; gap: 24px; } .format-links { gap: 40px; } .faq-section { grid-template-columns: 1fr; gap: 24px; padding-block: 48px; } .faq-section > div > p:not(.eyebrow) { max-width: none; } .cta-inner { flex-direction: column; align-items: start; padding-block: 40px; gap: 26px; } .cta-actions { align-items: start; } .site-footer { gap: 16px; } .site-footer p { flex-basis: 60%; } }
@media (max-width: 420px) { .hero-actions { align-items: start; flex-direction: column; gap: 16px; } .eyebrow { font-size: 9px; } .feature-grid { grid-template-columns: 1fr; } .feature-card { padding-block: 22px; } .file-badge { font-size: 6px; } .preview-formats { font-size: 8px; } .preview-formats b { font-size: 9px; } .roundtrip-flow { padding: 22px; } .flow-step { gap: 14px; } .flow-step p { font-size: 11px; } .ownership-card { padding: 22px; } .agent-flow { gap: 6px; } .agent-flow span { padding: 8px; font-size: 10px; } }
@media (prefers-reduced-motion: reduce) { .preview-slide *, .button { animation: none; transition: none; } .motion-toggle { display: none; } }
</style>
