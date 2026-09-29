/// <reference lib="webworker" />
import { simulate, type SimulationOptions } from './simulate';
import type { CardProfile } from './cardProfile';

export interface SimulationRequest {
  profiles: CardProfile[];
  options: Omit<SimulationOptions, 'random'>;
}

self.onmessage = (event: MessageEvent<SimulationRequest>) => {
  const { profiles, options } = event.data;
  self.postMessage(simulate(profiles, options));
};
