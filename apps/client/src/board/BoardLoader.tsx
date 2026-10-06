import { lazy, Suspense } from 'react';
import type { BoardProps } from './Board';
const Board = lazy(() => import('./Board').then(module => ({ default: module.IslandBoard })));
export type { BuildMode } from './Board';
export function IslandBoard(props: BoardProps) { return <Suspense fallback={<div className="board-loading">The island is waking…</div>}><Board {...props}/></Suspense>; }
