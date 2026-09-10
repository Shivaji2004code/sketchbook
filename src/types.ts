import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types';
export type Scene = { elements: readonly ExcalidrawElement[]; appState: Partial<AppState>; files: BinaryFiles };
export type Drawing = { id: string; title: string; scene: Scene; updatedAt: string; version: number; pending: boolean; deleted: boolean; thumbnail: string; editId: string };
