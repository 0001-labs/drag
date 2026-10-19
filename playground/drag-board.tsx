import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { flushSync } from 'react-dom';
import { createSortable, type SortableAxis, type SortableController } from '../src/sortable';
import { cellType, columnsDroppable, columnType, type Board, type Cell, type Column, type List, type MoveResult } from './board';
import { cellClass, rowsStyle } from './cell';

type Props = {
  board: Board;
  onStart: () => void;
  onMove: (result: MoveResult) => void;
};

const Sortable = createContext<SortableController | null>(null);

function useSortable(): SortableController {
  const controller = useContext(Sortable);
  if (!controller) throw new Error('Inside DragBoard only.');
  return controller;
}

/** A ref that registers its element as a list of sortable items. */
function useContainer(id: string, type: string, axis: SortableAxis) {
  const controller = useSortable();
  return useCallback(
    (element: HTMLDivElement | null) => (element ? controller.container({ element, id, type, axis }) : undefined),
    [controller, id, type, axis],
  );
}

/** A ref that registers its element as a sortable item, held by `handle` inside it or by itself. */
function useItem(id: string, type: string, handle?: string) {
  const controller = useSortable();
  return useCallback(
    (element: HTMLDivElement | null) => {
      if (!element) return undefined;
      const held = handle ? element.querySelector<HTMLElement>(handle) : null;
      return controller.item({ element, id, type, handle: held });
    },
    [controller, id, type, handle],
  );
}

/**
 * The board on Drag's sortable engine. React draws the board and hears only
 * the lift and the drop; everything between is the engine's.
 */
export function DragBoard({ board, onStart, onMove }: Props) {
  const callbacks = useRef({ onStart, onMove });
  callbacks.current = { onStart, onMove };
  const controller = useMemo(
    () =>
      createSortable({
        onDragStart: () => callbacks.current.onStart(),
        // The engine takes its offsets away right after, so the new order is drawn first.
        onDragEnd: (result) => flushSync(() => callbacks.current.onMove(result)),
      }),
    [],
  );
  useEffect(() => () => controller.destroy(), [controller]);

  return (
    <Sortable.Provider value={controller}>
      <div className="play-board">
        {board.map((list) => (
          <DragList key={list.id} list={list} />
        ))}
      </div>
    </Sortable.Provider>
  );
}

function DragList({ list }: { list: List }) {
  const columns = useContainer(columnsDroppable(list.id), columnType(list.id), 'horizontal');
  return (
    <section className="play-list" aria-label={list.title}>
      <h2 className="play-list__title">{list.title}</h2>
      <div className="play-list__columns" ref={columns}>
        {list.columns.map((column) => (
          <DragColumn key={column.id} column={column} listId={list.id} />
        ))}
      </div>
    </section>
  );
}

function DragColumn({ column, listId }: { column: Column; listId: string }) {
  const item = useItem(column.id, columnType(listId), ':scope > .play-column__name');
  const cells = useContainer(column.id, cellType, 'vertical');
  return (
    <div className="play-column" ref={item}>
      <div className="play-column__name">{column.title}</div>
      <div className="play-column__cells" ref={cells}>
        {column.cells.map((cell) => (
          <DragCell key={cell.id} cell={cell} />
        ))}
      </div>
    </div>
  );
}

function DragCell({ cell }: { cell: Cell }) {
  const item = useItem(cell.id, cellType);
  return (
    <div className={cellClass(cell)} ref={item} style={rowsStyle(cell)}>
      {cell.title}
    </div>
  );
}
