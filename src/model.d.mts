import type { Drawing, Scene } from './types';
import type { AppState } from '@excalidraw/excalidraw/types';
export function blankScene(): Scene;
export function newDrawing(title?: string, scene?: Scene): Drawing;
export function editDrawing(drawing: Drawing, changes: Partial<Drawing>): Drawing;
export function acknowledge(latest: Drawing, sent: Drawing, version: number): Drawing;
export function cleanAppState(state: Partial<AppState>): Partial<AppState>;
export function parseImport(text: string): Drawing[];
