export const blankScene = () => ({ elements: [], appState: { viewBackgroundColor: '#ffffff' }, files: {} });
export function newDrawing(title = 'Untitled drawing', scene = blankScene()) {
  return { id: crypto.randomUUID(), title: title.trim().slice(0, 120) || 'Untitled drawing', scene,
    updatedAt: new Date().toISOString(), version: 0, pending: true, deleted: false, thumbnail: '', editId: crypto.randomUUID() };
}
export function editDrawing(drawing, changes) {
  return { ...drawing, ...changes, updatedAt: new Date().toISOString(), pending: true, editId: crypto.randomUUID() };
}
// A completed request must not mark newer, in-flight edits as saved.
export function acknowledge(latest, sent, version) {
  return { ...latest, version, pending: latest.editId !== sent.editId };
}
export function cleanAppState(state) {
  const keys = ['viewBackgroundColor', 'gridSize', 'gridStep', 'gridModeEnabled', 'scrollX', 'scrollY', 'zoom'];
  return Object.fromEntries(keys.filter(key => state[key] !== undefined).map(key => [key, state[key]]));
}
export function parseImport(text) {
  const data = JSON.parse(text);
  const entries = data.type === 'shivaji-sketchbook' ? data.drawings : [{ title: 'Imported drawing', scene: data }];
  if (!Array.isArray(entries) || entries.length > 1000) throw new Error('Choose an Excalidraw file or a Sketchbook backup (up to 1,000 drawings).');
  return entries.map(entry => {
    const scene = entry.scene;
    if (!scene || !Array.isArray(scene.elements) || !scene.elements.every(el => el && typeof el.id === 'string' && typeof el.type === 'string')) throw new Error('This file does not contain valid Excalidraw elements.');
    const files = scene.files || {};
    if (typeof files !== 'object' || Array.isArray(files)) throw new Error('Invalid image data.');
    for (const [id, file] of Object.entries(files)) {
      if (!file || file.id !== id || typeof file.dataURL !== 'string' || !/^data:image\//.test(file.dataURL)) throw new Error('Invalid embedded image.');
    }
    return newDrawing(typeof entry.title === 'string' ? entry.title : 'Imported drawing', { elements: scene.elements, appState: cleanAppState(scene.appState || {}), files });
  });
}
