import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowRight, Cloud, CloudOff, Copy, FileUp, LayoutGrid, LoaderCircle, LogOut, Pencil, Plus, Search, Shapes, Sparkles, Trash2, Undo2, X } from 'lucide-react';
import { configured, ownerEmail, supabase } from './cloud';
import { newDrawing, parseImport } from './model.mjs';
import { useSketchbook } from './useSketchbook';
import type { Drawing } from './types';
const Editor = lazy(() => import('./Editor'));
function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = name.replace(/[<>:"/\\|?*]/g, '-'); link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
class EditorBoundary extends Component<{ children: ReactNode; back: () => void }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() { return this.state.error ? <div className="center-state"><h2>The editor couldn’t open</h2><p>Return to your drawings to export a backup or try again.</p><button className="button" onClick={this.props.back}>Back to drawings</button></div> : this.props.children; }
}
function Logo() { return <div className="brand"><span className="brand-mark"><Pencil size={22}/></span><span>sketchbook<span className="brand-dot">.</span></span></div>; }
export default function App() {
  const [owner, setOwner] = useState<string | null>(null);
  const [loading, setLoading] = useState(configured);
  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => { setOwner(data.session?.user.id || null); setLoading(false); }).catch(() => setLoading(false));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { setOwner(session?.user.id || null); setLoading(false); });
    return () => data.subscription.unsubscribe();
  }, []);
  if (loading) return <div className="center-state"><LoaderCircle className="spin"/>Opening your sketchbook…</div>;
  return owner ? <Workspace key={owner} owner={owner} logout={async () => { if (supabase && owner !== 'preview') { const { error } = await supabase.auth.signOut(); if (error) throw error; } setOwner(null); }}/>
    : <Login preview={() => setOwner('preview')}/>;
}
function Login({ preview }: { preview: () => void }) {
  const [username, setUsername] = useState('shivaji');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <main className="login-page"><Logo/><div className="login-layout">
    <section className="login-story"><span className="eyebrow">A LITTLE SPACE FOR BIG IDEAS</span><h1>Think it.<br/>Sketch it.<br/><span>Make it clear.</span></h1><p>Your structures, workflows, and little lightbulb moments. Each with a canvas of its own.</p><div className="sketch-illustration" aria-hidden="true"><span className="idea-node">An idea</span><span className="sketch-arrow">⤳</span><span className="flow-node">A clearer picture</span><span className="sketch-note">a little messy is good ↗</span></div></section>
    <section className="login-card"><span className="avatar large">S</span><h2>Your sketchbook awaits.</h2><p className="muted">A private place to work things out.</p>
      {configured ? <form onSubmit={async event => {
        event.preventDefault(); setBusy(true); setError('');
        try { if (username.trim().toLowerCase() !== 'shivaji') throw new Error('Use your username: shivaji.'); const { error } = await supabase!.auth.signInWithPassword({ email: ownerEmail, password }); if (error) throw error; }
        catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to sign in.'); } finally { setBusy(false); }
      }}><label>Username<input value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" required/></label><label>Password<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required/></label>{error && <p role="alert" className="form-error">{error}</p>}<button className="button full" disabled={busy}>{busy ? 'Signing in…' : 'Open sketchbook'}<ArrowRight size={17}/></button><div className="login-footnote"><Cloud size={14}/>Your drawings, synced across devices</div></form>
      : <><div className="setup-note"><CloudOff size={21}/><div><strong>Cloud connection needed</strong><p>Connect your Supabase project to enable your private login and save drawings online. See the included SETUP guide.</p></div></div><button className="button full" onClick={preview}>Explore a temporary preview<ArrowRight size={17}/></button><p className="fine-print">Nothing is saved in preview. Export anything you want to keep before closing.</p></>}
    </section></div><footer>YOUR SPACE. YOUR PACE. YOUR NEXT IDEA.</footer></main>;
}
function Workspace({ owner, logout }: { owner: string; logout: () => Promise<void> }) {
  const book = useSketchbook(owner);
  const [active, setActive] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [trash, setTrash] = useState(false);
  const [sort, setSort] = useState('recent');
  const [modal, setModal] = useState<{ type: 'create' | 'rename' | 'delete'; drawing?: Drawing } | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const selected = book.drawings.find(row => row.id === active);
  const count = book.drawings.filter(row => !row.deleted).length;
  const visible = book.drawings.filter(row => row.deleted === trash && row.title.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === 'name' ? a.title.localeCompare(b.title) : b.updatedAt.localeCompare(a.updatedAt));
  const report = (cause: unknown) => book.setError(cause instanceof Error ? cause.message : 'Something went wrong. Please retry.');
  const exportDrawing = (drawing: Drawing) => download(`${drawing.title}.excalidraw`, { type: 'excalidraw', version: 2, source: 'shivaji-sketchbook', ...drawing.scene });
  const backup = () => download(`sketchbook-${new Date().toISOString().slice(0, 10)}.json`, { type: 'shivaji-sketchbook', version: 1, drawings: book.drawings.filter(row => !row.deleted).map(({ title, scene }) => ({ title, scene })) });
  const openModal = (type: 'create' | 'rename' | 'delete', drawing?: Drawing) => { setName(drawing?.title || ''); setModal({ type, drawing }); };
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setModal(null); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, []);
  return <>
    {owner === 'preview' && <div className="preview-banner"><CloudOff size={14}/>Temporary preview — drawings are not saved. Export before closing.</div>}
    {book.error && <div className="error-banner" role="alert"><span>{book.error}</span><button onClick={() => { book.setError(''); void book.sync(); }}>Retry sync</button><button aria-label="Dismiss message" onClick={() => book.setError('')}><X size={16}/></button></div>}
    {selected ? <EditorBoundary back={() => setActive(null)}><Suspense fallback={<div className="center-state"><LoaderCircle className="spin"/>Preparing your canvas…</div>}><Editor key={selected.id} drawing={selected} status={book.status} onBack={() => setActive(null)} onSave={changes => book.save(selected.id, changes)} onSync={book.sync} onExport={() => exportDrawing(selected)}/></Suspense></EditorBoundary>
    : <div className="app-shell"><aside className="sidebar"><Logo/><div className="workspace-label">PERSONAL WORKSPACE</div><button className={`nav-item ${!trash ? 'selected' : ''}`} onClick={() => setTrash(false)}><LayoutGrid size={18}/>All drawings<span>{count}</span></button><button className={`nav-item ${trash ? 'selected' : ''}`} onClick={() => setTrash(true)}><Trash2 size={18}/>Trash<span>{book.drawings.filter(row => row.deleted).length || ''}</span></button><div className="sidebar-bottom"><div className="cloud-card"><Cloud size={20}/><strong>{owner === 'preview' ? 'Try a little sketch' : 'A home for every idea'}</strong><p>{owner === 'preview' ? 'This preview keeps nothing on your device after you close it.' : 'Your drawings live online. Open them wherever inspiration finds you.'}</p></div><button className="nav-item" onClick={backup}><ArrowDownToLine size={18}/>Export backup</button><div className="profile"><span className="avatar">S</span><div><strong>Shivaji</strong><small>Personal sketchbook</small></div><button className="icon-button" aria-label="Sign out" title="Sign out" onClick={() => { if (book.drawings.some(row => row.pending) && !window.confirm('Some drawings are not saved online. Export a backup before leaving. Sign out anyway?')) return; void logout().catch(report); }}><LogOut size={17}/></button></div></div></aside>
      <main className="main-content"><header className="topbar"><span className="breadcrumb">Workspace <span>/</span> <strong>{trash ? 'Trash' : 'All drawings'}</strong></span><button className="sync-indicator" onClick={() => void book.sync()} title="Refresh cloud drawings"><span className={book.status === 'All changes synced' ? 'status-dot' : 'status-dot amber'}/>{book.status}</button></header>
        <div className="page-content"><div className="page-heading"><div><span className="eyebrow">YOUR IDEAS, IN ONE PLACE</span><h1>{trash ? 'A second chance.' : 'Room to think.'}</h1><p>{trash ? 'Restore a drawing whenever you need it again.' : 'A fresh canvas for every structure, workflow, and what-if.'}</p></div>{!trash && <button className="button" onClick={() => openModal('create')} disabled={!book.ready}><Plus size={19}/>New drawing</button>}</div>
        {!trash && <button className="quick-start" onClick={() => openModal('create')}><span className="quick-icon"><Sparkles size={25}/></span><span><strong>Start with a blank canvas.</strong><small>No perfect first line needed. Just get your idea down.</small></span><span className="quick-action">Let’s sketch<ArrowRight size={17}/></span><span className="mini-sketch" aria-hidden="true"><i/><b>→</b><i/></span></button>}
        <div className="collection-toolbar"><div className="collection-title">{trash ? 'Deleted drawings' : 'Your drawings'}<span>{visible.length}</span></div><div className="collection-controls"><label className="search-box"><Search size={16}/><input aria-label="Search drawings" placeholder="Search drawings…" value={query} onChange={event => setQuery(event.target.value)}/></label><select aria-label="Sort drawings" value={sort} onChange={event => setSort(event.target.value)}><option value="recent">Last edited</option><option value="name">Name A–Z</option></select><button className="icon-button import-button" title="Import drawing or backup" aria-label="Import drawing or backup" onClick={() => file.current?.click()}><FileUp size={19}/></button></div></div>
        {!book.ready ? <div className="center-state"><LoaderCircle className="spin"/>Loading drawings…</div> : <div className="drawing-grid">
          {!trash && !query && <button className="new-card" onClick={() => openModal('create')}><span><Plus size={26}/></span><strong>New drawing</strong><small>A blank page. Endless possibilities.</small></button>}
          {visible.map(drawing => <article className="drawing-card" key={drawing.id}><button className="drawing-preview" onClick={() => !trash && setActive(drawing.id)} aria-label={`Open ${drawing.title}`} disabled={trash}>{drawing.thumbnail ? <img src={drawing.thumbnail} alt="" loading="lazy"/> : <span className="placeholder-sketch"><Shapes size={42} strokeWidth={1}/><span>{drawing.scene.elements.filter(element => !element.isDeleted).length ? 'Open your drawing' : 'A fresh canvas'}</span></span>}<span className="file-badge">EXCALIDRAW</span></button><div className="card-info"><button className="card-title" onClick={() => !trash && setActive(drawing.id)} disabled={trash}>{drawing.title}</button><div className="card-meta"><span>{new Date(drawing.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span><span>{drawing.pending ? (owner === 'preview' ? 'Temporary' : 'Unsaved') : 'Synced'}</span></div><div className="card-actions">{trash ? <button onClick={() => void book.save(drawing.id, { deleted: false }).then(book.sync).catch(report)}><Undo2 size={14}/>Restore</button> : <><button title="Rename" aria-label={`Rename ${drawing.title}`} onClick={() => openModal('rename', drawing)}><Pencil size={14}/></button><button title="Duplicate" aria-label={`Duplicate ${drawing.title}`} onClick={() => { const copy = newDrawing(`${drawing.title} (copy)`, drawing.scene) as Drawing; void book.put({ ...copy, thumbnail: drawing.thumbnail }).then(book.sync).catch(report); }}><Copy size={14}/></button><button title="Export" aria-label={`Export ${drawing.title}`} onClick={() => exportDrawing(drawing)}><ArrowDownToLine size={14}/></button><button title="Move to trash" aria-label={`Delete ${drawing.title}`} onClick={() => openModal('delete', drawing)}><Trash2 size={14}/></button></>}</div></div></article>)}
        </div>}
        {book.ready && visible.length === 0 && (trash || query) && <div className="empty-state"><Search size={28}/><h3>{query ? 'No drawings found' : 'Nothing in the trash'}</h3><p>{query ? 'Try a different name.' : 'Deleted drawings will appear here.'}</p></div>}
        <div className="workspace-footer"><span><Pencil size={13}/>Made for thinking out loud.</span><a href="https://github.com/excalidraw/excalidraw" target="_blank" rel="noreferrer">Powered by Excalidraw ↗</a></div>
      </div></main></div>}
    <input ref={file} type="file" accept=".json,.excalidraw" hidden onChange={async event => { const picked = event.target.files?.[0]; event.target.value = ''; if (!picked) return; try { if (picked.size > 50 * 1024 * 1024) throw new Error('Please import a file smaller than 50 MB.'); const imported = parseImport(await picked.text()) as Drawing[]; for (const drawing of imported) await book.put(drawing); await book.sync(); } catch (cause) { report(cause); } }}/>
    {modal && <div className="modal-backdrop" onClick={() => !busy && setModal(null)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={event => event.stopPropagation()}><button className="modal-close icon-button" aria-label="Close dialog" onClick={() => setModal(null)}><X size={19}/></button><span className="modal-icon">{modal.type === 'delete' ? <Trash2/> : <Pencil/>}</span><h2 id="modal-title">{modal.type === 'create' ? 'What’s on your mind?' : modal.type === 'rename' ? 'A new name.' : 'Move to trash?'}</h2><p>{modal.type === 'delete' ? `“${modal.drawing?.title}” can be restored from the trash.` : 'Give this canvas a name. You can change it anytime.'}</p><form onSubmit={async event => { event.preventDefault(); setBusy(true); try { if (modal.type === 'create') { const created = await book.create(name); setActive(created.id); } else if (modal.type === 'rename') { await book.save(modal.drawing!.id, { title: name.trim() || 'Untitled drawing' }); void book.sync(); } else { await book.save(modal.drawing!.id, { deleted: true }); void book.sync(); } setModal(null); } catch (cause) { report(cause); } finally { setBusy(false); } }}>{modal.type !== 'delete' && <label>Drawing name<input autoFocus placeholder="e.g. System architecture" value={name} maxLength={120} onChange={event => setName(event.target.value)}/></label>}<div className="modal-actions"><button type="button" className="button secondary" onClick={() => setModal(null)}>Cancel</button><button className={`button ${modal.type === 'delete' ? 'danger' : ''}`} disabled={busy}>{modal.type === 'create' ? 'Create drawing →' : modal.type === 'rename' ? 'Save name' : 'Move to trash'}</button></div></form></section></div>}
  </>;
}
