import { useCallback, useEffect, useRef, useState } from 'react';
import { acknowledge, editDrawing, newDrawing } from './model.mjs';
import { pullDrawings, pushDrawing, supabase } from './cloud';
import type { Drawing } from './types';

export function useSketchbook(owner: string) {
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [status, setStatus] = useState('Loading drawings…');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const rows = useRef<Drawing[]>([]);
  const syncing = useRef(false);
  const alive = useRef(true);
  const put = useCallback(async (drawing: Drawing) => {
    rows.current = [...rows.current.filter(row => row.id !== drawing.id), drawing];
    if (alive.current) setDrawings([...rows.current]);
  }, []);

  const sync = useCallback(async () => {
    if (!supabase || owner === 'preview') { setStatus('Preview · not saved'); return; }
    if (syncing.current || !alive.current) return;
    if (!navigator.onLine) { setStatus('Offline · keep this tab open'); return; }
    syncing.current = true;
    setStatus('Syncing…');
    try {
      for (const sent of rows.current.filter(row => row.pending)) {
        const version = await pushDrawing(owner, sent);
        if (!alive.current) return;
        const latest = rows.current.find(row => row.id === sent.id)!;
        if (version === null) {
          const remote = await pullDrawings([]);
          const original = remote.find(row => row.id === sent.id);
          if (!original) throw new Error('Could not refresh the original drawing. Export a backup before closing.');
          const newest = rows.current.find(row => row.id === sent.id)!;
          const copy = newDrawing(`${newest.title.slice(0, 100)} (conflict copy)`, newest.scene) as Drawing;
          await put({ ...copy, thumbnail: newest.thumbnail, deleted: false });
          await put(original);
          setError('Another device changed this drawing. Your edits are preserved in a conflict copy. Return to All drawings to open it.');
        } else { await put(acknowledge(latest, sent, version)); }
      }
      const remote = await pullDrawings(rows.current);
      if (!alive.current) return;
      for (const incoming of remote) {
        const latest = rows.current.find(row => row.id === incoming.id);
        if (!latest?.pending) await put(incoming);
      }
      setStatus(rows.current.some(row => row.pending) ? 'Unsaved changes…' : 'All changes synced');
    } catch (cause) {
      if (alive.current) {
        setStatus('Sync failed · keep this tab open');
        setError(cause instanceof Error ? cause.message : String((cause as { message?: string })?.message || 'Cloud sync failed. Check your connection and retry.'));
      }
    } finally { syncing.current = false; }
  }, [owner, put]);

  useEffect(() => {
    alive.current = true;
    void sync().then(() => { if (alive.current) setReady(true); });
    const timer = window.setInterval(() => void sync(), 8000);
    const online = () => void sync();
    const unload = (event: BeforeUnloadEvent) => {
      if (rows.current.some(row => row.pending)) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('online', online);
    window.addEventListener('beforeunload', unload);
    return () => { alive.current = false; clearInterval(timer); window.removeEventListener('online', online); window.removeEventListener('beforeunload', unload); };
  }, [sync]);
  const save = useCallback(async (id: string, changes: Partial<Drawing>) => {
    const latest = rows.current.find(row => row.id === id);
    if (!latest) throw new Error('Drawing not found.');
    await put(editDrawing(latest, changes));
    setStatus(owner === 'preview' ? 'Preview · not saved' : 'Unsaved changes…');
  }, [owner, put]);
  const create = useCallback(async (title = 'Untitled drawing') => {
    const drawing = newDrawing(title) as Drawing; await put(drawing); void sync(); return drawing;
  }, [put, sync]);
  return { drawings, status, error, setError, ready, save, create, put, sync };
}
