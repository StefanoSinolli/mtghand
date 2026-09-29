import type { ComponentType } from 'react';
import { createHashRouter, type RouteObject } from 'react-router';
import AppShell from './components/layout/AppShell';
import DeckListPage from './pages/DeckListPage';
import DeckLayout from './pages/DeckLayout';
import DeckOverviewPage from './pages/DeckOverviewPage';
import NotFoundPage from './pages/NotFoundPage';

// Pagine pesanti (analisi, animazioni, editor) caricate solo quando servono
const lazy = (load: () => Promise<{ default: ComponentType }>): Pick<RouteObject, 'lazy'> => ({
  lazy: async () => ({ Component: (await load()).default }),
});

const deckPages = (editable: boolean): RouteObject[] => [
  { index: true, element: <DeckOverviewPage /> },
  { path: 'hand', ...lazy(() => import('./pages/HandPage')) },
  { path: 'analysis', ...lazy(() => import('./pages/AnalysisPage')) },
  { path: 'stats', ...lazy(() => import('./pages/StatsPage')) },
  ...(editable ? [{ path: 'edit', ...lazy(() => import('./pages/EditorPage')) }] : []),
];

// Hash router: funziona anche servendo la build statica da una sottocartella (es. MAMP) o da Vercel
export const router = createHashRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <DeckListPage /> },
      { path: 'import', ...lazy(() => import('./pages/ImportPage')) },
      { path: 'new', ...lazy(() => import('./pages/EditorPage')) },
      { path: 'deck/:id', element: <DeckLayout />, children: deckPages(true) },
      { path: 's/:payload', ...lazy(() => import('./pages/SharedDeckLayout')), children: deckPages(false) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
