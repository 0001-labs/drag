/** The board both engines draw: lists of columns of cells, as Ezo lays them out. */

export type CellKind = 'item' | 'header' | 'text';

export type Cell = {
  id: string;
  kind: CellKind;
  title: string;
  /** How many squares high the cell is. */
  rows: number;
};

export type Column = {
  id: string;
  title: string;
  cells: Cell[];
};

export type List = {
  id: string;
  title: string;
  columns: Column[];
};

export type Board = List[];

export type Load = 'few' | 'many';

export type MoveResult = {
  draggableId: string;
  type: string;
  source: { droppableId: string; index: number };
  destination: { droppableId: string; index: number } | null;
};

const lists: Array<{ id: string; title: string; columns: Array<[string, string[]]> }> = [
  {
    id: 'week',
    title: 'Week',
    columns: [
      ['Monday', ['# Morning', 'Write the brief', 'Call Mika', 'Read the contract once more before signing it', '# Afternoon', 'Ship the fix', 'Groceries']],
      ['Tuesday', ['Studio day', 'Review the board', '# Evening', 'Dinner with Ana', 'Plan the trip to Kyoto: trains, the ryokan and the gardens worth the early start']],
      ['Wednesday', ['Dentist', 'Pay rent', 'Gym', '# Notes', 'The tall cell moves everything by its size']],
    ],
  },
  {
    id: 'studio',
    title: 'Studio',
    columns: [
      ['Ideas', ['A paper planner', 'Drag in every list', 'Lists that sort themselves by what is due, and what is waiting on someone', 'Typewriter font']],
      ['Doing', ['# This week', 'Playground', 'Drag engine', 'Port the board', 'Bench page']],
      ['Done', ['Plan', 'Measure Pangea', 'Release 0.2.0-alpha.0', 'Sync 1 copy']],
    ],
  },
  {
    id: 'reading',
    title: 'Reading',
    columns: [
      ['Books', ['The Design of Everyday Things', 'Shape Up', 'A Pattern Language, slowly, a few patterns each evening', 'Thinking in Systems']],
      ['Articles', ['Inventing on principle', 'Magic ink', '# Saved', 'Local-first software', 'The web as a medium']],
      ['Films', ['Perfect Days', 'Paterson', 'Columbus']],
    ],
  },
];

/** A text cell runs to more squares the longer it is, as Ezo's paragraphs do. */
function cellFrom(id: string, title: string): Cell {
  if (title.startsWith('# ')) return { id, kind: 'header', title: title.slice(2), rows: 1 };
  if (title.length > 24) return { id, kind: 'text', title, rows: Math.min(4, Math.ceil(title.length / 11)) };
  return { id, kind: 'item', title, rows: 1 };
}

export function createBoard(load: Load): Board {
  const repeat = load === 'many' ? 6 : 1;
  return lists.map((list) => ({
    id: list.id,
    title: list.title,
    columns: list.columns.map(([title, cells], columnIndex) => {
      const columnId = `${list.id}-${columnIndex}`;
      const all: Cell[] = [];
      for (let round = 0; round < repeat; round++) {
        cells.forEach((cell, cellIndex) => {
          const title = round === 0 || cell.startsWith('# ') ? cell : `${cell} ${round + 1}`;
          all.push(cellFrom(`${columnId}-${round}-${cellIndex}`, title));
        });
      }
      return { id: columnId, title, cells: all };
    }),
  }));
}

/** The droppable that holds a list's columns. */
export const columnsDroppable = (listId: string) => `${listId}:columns`;
export const columnType = (listId: string) => `column:${listId}`;
export const cellType = 'cell';

/** The board after a drop: a cell into any column, or a column within its list. */
export function applyMove(board: Board, result: MoveResult): Board {
  const { source, destination } = result;
  if (!destination) return board;
  if (source.droppableId === destination.droppableId && source.index === destination.index) return board;

  if (result.type === cellType) {
    let moved: Cell | undefined;
    const removed = board.map((list) => ({
      ...list,
      columns: list.columns.map((column) => {
        if (column.id !== source.droppableId) return column;
        const cells = [...column.cells];
        [moved] = cells.splice(source.index, 1);
        return { ...column, cells };
      }),
    }));
    if (!moved) return board;
    const cell = moved;
    return removed.map((list) => ({
      ...list,
      columns: list.columns.map((column) => {
        if (column.id !== destination.droppableId) return column;
        const cells = [...column.cells];
        cells.splice(destination.index, 0, cell);
        return { ...column, cells };
      }),
    }));
  }

  return board.map((list) => {
    if (columnsDroppable(list.id) !== source.droppableId || source.droppableId !== destination.droppableId) return list;
    const columns = [...list.columns];
    const [column] = columns.splice(source.index, 1);
    if (column) columns.splice(destination.index, 0, column);
    return { ...list, columns };
  });
}
