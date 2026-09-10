import { createClient } from '@supabase/supabase-js';
import type { Drawing, Scene } from './types';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const ownerEmail = import.meta.env.VITE_OWNER_EMAIL || '';
export const configured = !!(url?.startsWith('https://') && key && ownerEmail && !url.includes('YOUR_PROJECT'));
export const supabase = configured ? createClient(url, key) : null;
const uploaded = new Set<string>();
type CloudScene = Omit<Scene, 'files'> & { files: Record<string, { id: string; mimeType: string; created: number; storagePath: string }> };
type Row = { id: string; title: string; scene: CloudScene; updated_at: string; version: number; deleted: boolean; thumbnail: string };
async function blobDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob); });
}
export async function pushDrawing(owner: string, drawing: Drawing): Promise<number | null> {
  const client = supabase!;
  const files: CloudScene['files'] = {};
  for (const [id, file] of Object.entries(drawing.scene.files)) {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('An image has an invalid identifier. Export the drawing as a backup.');
    const storagePath = `${owner}/${drawing.id}/${id}`;
    if (!uploaded.has(storagePath)) {
      const blob = await (await fetch(file.dataURL)).blob();
      const { error } = await client.storage.from('drawing-images').upload(storagePath, blob, { contentType: file.mimeType, upsert: true });
      if (error) throw error;
      uploaded.add(storagePath);
    }
    files[id] = { id, mimeType: file.mimeType, created: file.created, storagePath };
  }
  const { data, error } = await client.rpc('save_drawing', { drawing_id: drawing.id, drawing_title: drawing.title, drawing_scene: { ...drawing.scene, files }, drawing_thumbnail: drawing.thumbnail, drawing_deleted: drawing.deleted, expected_version: drawing.version });
  if (error) throw error;
  return data;
}
export async function pullDrawings(cached: Drawing[]): Promise<Drawing[]> {
  // Poll only identities and versions. Unchanged canvases and images are not re-downloaded.
  const versions: { id: string; version: number }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data: page, error } = await supabase!.from('drawings').select('id,version').order('id').range(from, from + 999);
    if (error) throw error;
    versions.push(...page);
    if (page.length < 1000) break;
  }
  const changed = versions.filter(row => !cached.some(local => local.id === row.id && local.version === row.version));
  const data: Row[] = [];
  for (let from = 0; from < changed.length; from += 100) {
    const { data: page, error } = await supabase!.from('drawings').select('*').in('id', changed.slice(from, from + 100).map(row => row.id));
    if (error) throw error;
    data.push(...page as Row[]);
  }
  return Promise.all(data.map(async row => {
    const local = cached.find(item => item.id === row.id);
    if (local && local.version === row.version) return local;
    const files: Scene['files'] = {};
    for (const [id, file] of Object.entries(row.scene.files || {})) {
      if (local?.scene.files[id]) { files[id] = local.scene.files[id]; continue; }
      const { data: blob, error: imageError } = await supabase!.storage.from('drawing-images').download(file.storagePath);
      if (imageError) throw imageError;
      files[id] = { id, mimeType: file.mimeType, created: file.created, dataURL: await blobDataURL(blob) } as Scene['files'][string];
    }
    return { id: row.id, title: row.title, scene: { ...row.scene, files }, updatedAt: row.updated_at, version: row.version, pending: false, deleted: row.deleted, thumbnail: row.thumbnail, editId: crypto.randomUUID() };
  }));
}
