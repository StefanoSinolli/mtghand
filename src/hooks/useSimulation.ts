import { useCallback, useEffect, useRef, useState } from 'react';
import type { CardProfile } from '../analysis/cardProfile';
import type { SimulationResult } from '../analysis/simulate';
import type { SimulationRequest } from '../analysis/simulate.worker';

/**
 * Esegue la simulazione Monte Carlo in un Web Worker per non bloccare l'interfaccia
 */
export const useSimulation = () => {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [running, setRunning] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const run = useCallback((profiles: CardProfile[], games = 10000) => {
    workerRef.current?.terminate();
    const worker = new Worker(new URL('../analysis/simulate.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    setRunning(true);

    worker.onmessage = (event: MessageEvent<SimulationResult>) => {
      setResult(event.data);
      setRunning(false);
      worker.terminate();
    };
    worker.onerror = (error) => {
      console.error('Errore nella simulazione', error);
      setRunning(false);
    };

    const request: SimulationRequest = { profiles, options: { games } };
    worker.postMessage(request);
  }, []);

  const reset = useCallback(() => setResult(null), []);

  return { result, running, run, reset };
};
