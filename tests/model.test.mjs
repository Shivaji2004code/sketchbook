import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newDrawing, editDrawing, acknowledge, parseImport, cleanAppState } from '../src/model.mjs';
test('save response does not lose edits made during a request', () => {
  const sent = newDrawing('Workflow');
  const newer = editDrawing(sent, { title: 'Newer title' });
  const result = acknowledge(newer, sent, 2);
  assert.equal(result.pending, true); assert.equal(result.title, 'Newer title'); assert.equal(result.version, 2);
  assert.equal(acknowledge(sent, sent, 1).pending, false);
});
test('import assigns separate identities and preserves scene and embedded images', () => {
  const scene = { elements: [{ id: 'shape', type: 'rectangle' }], appState: { viewBackgroundColor: '#fff', collaborators: {} }, files: { image1: { id: 'image1', dataURL: 'data:image/png;base64,AA==', mimeType: 'image/png', created: 1 } } };
  const imported = parseImport(JSON.stringify({ type: 'shivaji-sketchbook', drawings: [{ title: 'One', scene }, { title: 'Two', scene }] }));
  assert.notEqual(imported[0].id, imported[1].id); assert.equal(imported[1].scene.files.image1.dataURL, scene.files.image1.dataURL);
  assert.equal(imported[0].scene.appState.collaborators, undefined); assert.equal(imported[0].version, 0);
});
test('invalid imports fail instead of partially importing', () => {
  assert.throws(() => parseImport('{}'));
  assert.throws(() => parseImport(JSON.stringify({ elements: [], files: { bad: { id: 'bad', dataURL: 'https://example.com' } } })));
  assert.throws(() => parseImport(JSON.stringify({ type: 'shivaji-sketchbook', drawings: [{ scene: { elements: [] } }, { scene: {} }] })));
});
test('persistent scene state excludes transient selection and collaborators', () => {
  assert.deepEqual(cleanAppState({ scrollX: 4, selectedElementIds: { x: true }, collaborators: new Map(), viewBackgroundColor: '#fff' }), { viewBackgroundColor: '#fff', scrollX: 4 });
});
