import { SortableProvider, useSortableContainer, useSortableItem } from '../src/react';
import { cellType, columnsDroppable, columnType, type Board, type Cell, type Column, type List, type MoveResult } from './board';
import { cellClass, rowsStyle } from './cell';

type Props = {
  board: Board;
  onStart: () => void;
  onMove: (result: MoveResult) => void;
};

/**
 * The board on Drag's sortable engine through its React layer. React draws the
 * board and hears only the lift and the drop; everything between is the engine's.
 */
export function DragBoard({ board, onStart, onMove }: Props) {
  return (
    <SortableProvider onDragStart={onStart} onDragEnd={onMove}>
      <div className="play-board">
        {board.map((list) => (
          <DragList key={list.id} list={list} />
        ))}
      </div>
    </SortableProvider>
  );
}

function DragList({ list }: { list: List }) {
  const columns = useSortableContainer<HTMLDivElement>(columnsDroppable(list.id), {
    type: columnType(list.id),
    axis: 'horizontal',
    label: list.title,
  });
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
  const item = useSortableItem<HTMLDivElement>(column.id, {
    type: columnType(listId),
    handle: ':scope > .play-column__name',
    label: column.title,
  });
  const cells = useSortableContainer<HTMLDivElement>(column.id, { type: cellType, label: column.title });
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
  const item = useSortableItem<HTMLDivElement>(cell.id, { type: cellType });
  return (
    <div className={cellClass(cell)} ref={item} style={rowsStyle(cell)}>
      {cell.title}
    </div>
  );
}
