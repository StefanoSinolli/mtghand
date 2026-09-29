import { createHashRouter } from 'react-router';
import AppShell from './components/layout/AppShell';
import DeckListPage from './pages/DeckListPage';
import ImportPage from './pages/ImportPage';
import EditorPage from './pages/EditorPage';
import DeckLayout from './pages/DeckLayout';
import DeckOverviewPage from './pages/DeckOverviewPage';
import HandPage from './pages/HandPage';
import AnalysisPage from './pages/AnalysisPage';
import NotFoundPage from './pages/NotFoundPage';

// Hash router: funziona anche servendo la build statica da una sottocartella (es. MAMP)
export const router = createHashRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <DeckListPage /> },
      { path: 'import', element: <ImportPage /> },
      { path: 'new', element: <EditorPage /> },
      {
        path: 'deck/:id',
        element: <DeckLayout />,
        children: [
          { index: true, element: <DeckOverviewPage /> },
          { path: 'hand', element: <HandPage /> },
          { path: 'analysis', element: <AnalysisPage /> },
          { path: 'edit', element: <EditorPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
