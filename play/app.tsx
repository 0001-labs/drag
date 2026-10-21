import { Profiler, useState } from 'react';
import { applyMove, createBoard, type Load, type MoveResult } from './board';
import { DragBoard } from './drag-board';
import { countRender, startMeasuring, stopMeasuring, type Reading } from './meter';

function fromAddress<T extends string>(name: string, values: readonly T[], fallback: T): T {
  const value = new URLSearchParams(location.search).get(name);
  return values.includes(value as T) ? (value as T) : fallback;
}

function toAddress(name: string, value: string): void {
  const url = new URL(location.href);
  url.searchParams.set(name, value);
  history.replaceState(null, '', url);
}

export function App() {
  const [load, setLoad] = useState<Load>(() => fromAddress('cells', ['few', 'many'], 'few'));
  const [board, setBoard] = useState(() => createBoard(load));
  const [reading, setReading] = useState<Reading | null>(null);

  const chooseLoad = (next: Load) => {
    setLoad(next);
    setBoard(createBoard(next));
    setReading(null);
    toAddress('cells', next);
  };

  const onStart = () => startMeasuring();
  const onMove = (result: MoveResult) => {
    const measured = stopMeasuring();
    setBoard((current) => applyMove(current, result));
    if (measured) setReading(measured);
  };

  return (
    <section className="play" aria-label="Play">
      <div className="bar">
        <div className="ds-tabs" role="group" aria-label="Cells">
          {(['few', 'many'] as const).map((value) => (
            <button key={value} type="button" className="ds-button" aria-pressed={load === value} onClick={() => chooseLoad(value)}>
              {value === 'few' ? 'Few cells' : 'Many cells'}
            </button>
          ))}
        </div>
        <button type="button" className="ds-button ds-button--secondary" onClick={() => chooseLoad(load)}>
          Reset
        </button>
      </div>
      <p className="readout" aria-live="polite">
        {reading ? <ReadingLine reading={reading} /> : 'Move a cell, or a column by its name. On a phone, hold a cell to lift it. Each drag is measured from lift to drop.'}
      </p>
      <div className="play-board-scroller">
        <Profiler id="board" onRender={countRender}>
          <DragBoard board={board} onStart={onStart} onMove={onMove} />
        </Profiler>
      </div>
    </section>
  );
}

function ReadingLine({ reading }: { reading: Reading }) {
  const renders = reading.renders === 1 ? '1 render' : `${reading.renders} renders`;
  return (
    <>
      Last drag: <span className="figure">{reading.frames}</span> frames a second, longest frame{' '}
      <span className="figure">{reading.longestFrame}</span> ms, pointer <span className="figure">{reading.pointerRate}</span> a second,{' '}
      <span className="figure">{renders}</span> of React.
    </>
  );
}
