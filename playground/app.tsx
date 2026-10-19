import { Profiler, useState } from 'react';
import { applyMove, createBoard, type Load, type MoveResult } from './board';
import { DragBoard } from './drag-board';
import { countRender, startMeasuring, stopMeasuring, type Reading } from './meter';
import { PangeaBoard } from './pangea-board';

type Engine = 'drag' | 'pangea';

const engineNames: Record<Engine, string> = { drag: 'Drag', pangea: 'Pangea' };

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
  const [engine, setEngine] = useState<Engine>(() => fromAddress('engine', ['drag', 'pangea'], 'drag'));
  const [load, setLoad] = useState<Load>(() => fromAddress('cells', ['few', 'many'], 'few'));
  const [board, setBoard] = useState(() => createBoard(load));
  const [reading, setReading] = useState<{ engine: Engine; reading: Reading } | null>(null);

  const chooseEngine = (next: Engine) => {
    setEngine(next);
    setReading(null);
    toAddress('engine', next);
  };
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
    if (measured) setReading({ engine, reading: measured });
  };

  const Board = engine === 'drag' ? DragBoard : PangeaBoard;

  return (
    <main className="page">
      <header className="bar">
        <h1 className="bar__title">Drag playground</h1>
        <div className="ds-tabs" role="group" aria-label="Engine">
          {(['drag', 'pangea'] as const).map((value) => (
            <button key={value} type="button" className="ds-button" aria-pressed={engine === value} onClick={() => chooseEngine(value)}>
              {engineNames[value]}
            </button>
          ))}
        </div>
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
        <a className="ds-link bar__docs" href="/">
          Docs
        </a>
      </header>
      <p className="readout" aria-live="polite">
        {reading ? <ReadingLine engine={reading.engine} reading={reading.reading} /> : 'Move a cell, or a column by its name. On a phone, hold a cell to lift it. Each drag is measured from lift to drop.'}
      </p>
      <div className="play-board-scroller">
        <Profiler id="board" onRender={countRender}>
          <Board key={engine} board={board} onStart={onStart} onMove={onMove} />
        </Profiler>
      </div>
    </main>
  );
}

function ReadingLine({ engine, reading }: { engine: Engine; reading: Reading }) {
  const renders = reading.renders === 1 ? '1 render' : `${reading.renders} renders`;
  return (
    <>
      {engineNames[engine]}, last drag: <span className="figure">{reading.frames}</span> frames a second, longest frame{' '}
      <span className="figure">{reading.longestFrame}</span> ms, pointer <span className="figure">{reading.pointerRate}</span> a second,{' '}
      <span className="figure">{renders}</span> of React.
    </>
  );
}
