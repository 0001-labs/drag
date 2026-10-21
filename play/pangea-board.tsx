import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { cellType, columnsDroppable, columnType, type Board, type MoveResult } from './board';
import { cellClass, rowsStyle } from './cell';

type Props = {
  board: Board;
  onStart: () => void;
  onMove: (result: MoveResult) => void;
};

/** The board on @hello-pangea/dnd, as Ezo, Link and Consistency used it before they moved to Drag. */
export function PangeaBoard({ board, onStart, onMove }: Props) {
  return (
    <DragDropContext onDragStart={onStart} onDragEnd={(result: DropResult) => onMove(result)}>
      <div className="play-board">
        {board.map((list) => (
          <section className="play-list" key={list.id} aria-label={list.title}>
            <h2 className="play-list__title">{list.title}</h2>
            <Droppable droppableId={columnsDroppable(list.id)} type={columnType(list.id)} direction="horizontal">
              {(columns) => (
                <div className="play-list__columns" ref={columns.innerRef} {...columns.droppableProps}>
                  {list.columns.map((column, columnIndex) => (
                    <Draggable draggableId={column.id} index={columnIndex} key={column.id}>
                      {(columnDrag, columnState) => (
                        <div
                          className="play-column"
                          ref={columnDrag.innerRef}
                          {...columnDrag.draggableProps}
                          data-lifted={columnState.isDragging || undefined}
                        >
                          <div className="play-column__name" {...columnDrag.dragHandleProps}>
                            {column.title}
                          </div>
                          <Droppable droppableId={column.id} type={cellType}>
                            {(cells) => (
                              <div className="play-column__cells" ref={cells.innerRef} {...cells.droppableProps}>
                                {column.cells.map((cell, cellIndex) => (
                                  <Draggable draggableId={cell.id} index={cellIndex} key={cell.id}>
                                    {(cellDrag, cellState) => (
                                      <div
                                        className={cellClass(cell)}
                                        ref={cellDrag.innerRef}
                                        {...cellDrag.draggableProps}
                                        {...cellDrag.dragHandleProps}
                                        style={{ ...cellDrag.draggableProps.style, ...rowsStyle(cell) }}
                                        data-lifted={cellState.isDragging || undefined}
                                      >
                                        {cell.title}
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                                {cells.placeholder}
                              </div>
                            )}
                          </Droppable>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {columns.placeholder}
                </div>
              )}
            </Droppable>
          </section>
        ))}
      </div>
    </DragDropContext>
  );
}
