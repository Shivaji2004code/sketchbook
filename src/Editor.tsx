import { useEffect, useRef, useState } from 'react';
import { Excalidraw, exportToSvg } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';
import { ArrowLeft, Cloud, Download } from 'lucide-react';
import { cleanAppState } from './model.mjs';
import type { Drawing } from './types';

export default function Editor({ drawing, status, onSave, onBack, onExport, onSync }: {
  drawing: Drawing; status: string; onSave: (changes: Partial<Drawing>) => Promise<void>;
  onBack: () => void; onExport: () => void; onSync: () => Promise<void>;
}) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [title, setTitle] = useState(drawing.title);
  const [leaving, setLeaving] = useState(false);
  const initial = useRef(drawing);
  const fingerprint = useRef('');
  const saveRef = useRef(onSave); saveRef.current = onSave;
  const syncRef = useRef(onSync); syncRef.current = onSync;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => { clearTimeout(timer.current); }, []);
  useEffect(() => {
    if (!api || drawing.pending) return;
    const signature = JSON.stringify([drawing.scene.elements, cleanAppState(drawing.scene.appState), Object.keys(drawing.scene.files)]);
    if (fingerprint.current && signature !== fingerprint.current) {
      fingerprint.current = signature;
      api.addFiles(Object.values(drawing.scene.files));
      api.updateScene({
        elements: drawing.scene.elements,
        appState: { ...api.getAppState(), ...cleanAppState(drawing.scene.appState) },
      });
      setTitle(drawing.title);
    }
  }, [api, drawing]);
  async function leave() {
    setLeaving(true);
    try {
      if (api) {
        try {
          const svg = await exportToSvg({ elements: api.getSceneElements(), appState: { ...api.getAppState(), exportWithDarkMode: false }, files: api.getFiles() });
          const thumbnail = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.outerHTML)}`;
          await onSave({ thumbnail: thumbnail.length < 250_000 ? thumbnail : '' });
        } catch { /* Thumbnail failure must not prevent returning to the gallery. */ }
      }
      clearTimeout(timer.current);
      await onSync(); onBack();
    } finally { setLeaving(false); }
  }
  return <div className="editor-shell"><header className="editor-header">
    <button className="icon-button" title="All drawings" aria-label="Back to all drawings" onClick={() => void leave()} disabled={leaving}><ArrowLeft size={19}/></button><span className="header-divider"/>
    <input className="drawing-title" aria-label="Drawing name" value={title} maxLength={120} onChange={event => setTitle(event.target.value)} onBlur={() => { const value = title.trim() || 'Untitled drawing'; setTitle(value); void onSave({ title: value }); }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}/>
    <span className="editor-status"><Cloud size={14}/>{status}</span><button className="button secondary small" onClick={onExport}><Download size={15}/><span>Export file</span></button>
  </header><div className="canvas"><Excalidraw excalidrawAPI={setApi} initialData={{ ...initial.current.scene, scrollToContent: true }} name={title}
    onChange={(elements, state, files) => {
      const appState = cleanAppState(state);
      const signature = JSON.stringify([elements, appState, Object.keys(files)]);
      if (fingerprint.current === signature) return;
      if (!fingerprint.current) { fingerprint.current = signature; return; }
      fingerprint.current = signature;
      void saveRef.current({ scene: { elements: [...elements], appState, files: { ...files } } });
      clearTimeout(timer.current); timer.current = setTimeout(() => void syncRef.current(), 1500);
    }} UIOptions={{ canvasActions: { loadScene: true, saveToActiveFile: false, export: { saveFileToDisk: true }, toggleTheme: true } }}/></div></div>;
}
