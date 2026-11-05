import test from 'node:test';
import assert from 'node:assert/strict';
import {directSlideJump} from '../../desq-core/shared-vuejs/src/edlib/html-import/slide-links.mjs';
import {collectHtmlSlideLinks,hasHtmlSlideLinks,resolveHtmlSlideLinks} from '../editor-vuejs/src/lib/agent/html-slide-links.mjs';

test('literal gotoSlide calls are recognized without interpreting JavaScript',()=>{
  assert.equal(directSlideJump("goToSlide('slide-2')"),'slide-2');
  assert.equal(directSlideJump(' return gotoSlide("slide-win"); '),'slide-win');
  for(const handler of ["goToSlide(target)","checkAnswer(true)","goToSlide('slide-2');alert(1)","goToSlide('slide-' + id)"])
    assert.equal(directSlideJump(handler),null);
});

test('HTML links resolve to native destination IDs inside grouped button artwork',()=>{
  const pages=[{shapes:[{id:'button',sourceIds:['desq-html-slide-link-2-7'],children:[{id:'label',sourceIds:['desq-html-slide-link-2-7']}]}]},{shapes:[]}];
  pages.forEach(page=>collectHtmlSlideLinks(page.shapes));
  assert.ok(hasHtmlSlideLinks(pages));
  resolveHtmlSlideLinks(pages,['inserted-a','inserted-b']);
  assert.equal(pages[0].shapes[0].link,'@sld:inserted-b');
  assert.equal(pages[0].shapes[0].children[0].link,'@sld:inserted-b');
  assert.equal(hasHtmlSlideLinks(pages),false);
  assert.throws(()=>resolveHtmlSlideLinks([{shapes:[{htmlSlideTargetIndex:4}]}],['only']),/missing slide/);
});
