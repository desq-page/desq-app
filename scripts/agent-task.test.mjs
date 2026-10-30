import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAgentTask, validateAgentTaskPlan } from '../editor-vuejs/src/lib/agent/agent-task.mjs';

test('creation includes the selected slide count, effort and topic', () => {
  for (const count of [1, 10]) for (const effort of ['quick', 'detailed']) {
    const task = buildAgentTask({ mode: 'create', count, effort, topic: 'Solar energy' });
    assert.match(task.prompt, new RegExp(`exactly ${count} editable`));
    assert.match(task.prompt, /Solar energy/);
    assert.match(task.prompt, effort === 'quick' ? /Quickly/ : /Detailed/);
    assert.ok(task.prompt.length <= 4000);
  }
  for (const count of [0, 11, 1.5, '', NaN]) assert.throws(() => buildAgentTask({ mode: 'create', count, effort: 'quick', topic: 'Test' }), /1 to 10/);
});

test('editing requests a single replacement and ignores stale creation fields', () => {
  const task = buildAgentTask({ mode: 'edit', command: 'Use larger text', count: 10, topic: 'Old topic', effort: 'detailed' });
  assert.match(task.prompt, /Use larger text/);
  assert.match(task.prompt, /replace the current slide in place/);
  assert.ok(!task.prompt.includes('Old topic'));
});

test('tab constraints reject unexpected mutations or slide counts before execution', () => {
  const plan = count => ({ calls: [{ name: 'desq_create_deck', arguments: { slides: Array(count).fill({}) } }] });
  validateAgentTaskPlan(plan(3), 'create', 3);
  validateAgentTaskPlan(plan(1), 'edit', 10);
  assert.throws(() => validateAgentTaskPlan(plan(2), 'edit', 2), /exactly 1/);
  assert.throws(() => validateAgentTaskPlan(plan(2), 'create', 3), /exactly 3/);
  assert.throws(() => validateAgentTaskPlan({ calls: [{ name: 'desq_delete_shape' }] }, 'create', 1), /No edits applied/);
  validateAgentTaskPlan({ calls: [] }, 'edit', 1);
});

test('local create and replacement requests avoid cloud editor-tool instructions', () => {
  for (const mode of ['create', 'edit']) {
    const task = buildAgentTask({mode,local:true,slideAuthoring:'html',count:2,effort:'quick',topic:'Solar power',command:'Simplify the slide'});
    assert.doesNotMatch(task.prompt,/desq_|layout=html/);
    assert.match(task.prompt,/do not issue editor commands/);
    assert.match(task.prompt,/requested format now/);
    assert.doesNotMatch(task.prompt,/next step/);
  }
});

test('local Markdown task requests finished content now rather than an obsolete future markup stage',()=>{
  for(const mode of ['create','edit']){
    const task=buildAgentTask({mode,local:true,slideAuthoring:'markdown',count:2,effort:'quick',topic:'Solar',command:'Simplify'});
    assert.match(task.prompt,/Markdown.*now/);
    assert.doesNotMatch(task.prompt,/next step|desq_/);
  }
});

test('Auto lets cloud and local models choose 1 to 10 slides', () => {
  for (const local of [false, true]) for (const slideAuthoring of ['svg', 'html', 'markdown']) {
    const task = buildAgentTask({ mode: 'create', count: 'auto', effort: 'quick', topic: 'Solar energy', local, slideAuthoring });
    assert.match(task.label, /Auto/);
    assert.match(task.prompt, /1 to 10/);
    assert.doesNotMatch(task.prompt, /exactly auto/);
    if (local) assert.doesNotMatch(task.prompt, /desq_/);
  }
  const plan = count => ({ calls: [{ name: 'desq_create_deck', arguments: { slides: Array(count).fill({}) } }] });
  validateAgentTaskPlan(plan(1), 'create', 'auto');
  validateAgentTaskPlan(plan(10), 'create', 'auto');
  assert.throws(() => validateAgentTaskPlan(plan(0), 'create', 'auto'), /1 to 10/);
  assert.throws(() => validateAgentTaskPlan(plan(11), 'create', 'auto'), /1 to 10/);
  assert.throws(() => validateAgentTaskPlan(plan(2), 'edit', 'auto'), /exactly 1/);
});
