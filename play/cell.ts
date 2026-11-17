import type { CSSProperties } from 'react';
import type { Cell } from './board';

export const cellClass = (cell: Cell) => `play-cell play-cell--${cell.kind}`;

export const rowsStyle = (cell: Cell) => ({ '--rows': cell.rows }) as CSSProperties;
