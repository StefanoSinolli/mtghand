import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { useEffect } from 'react';
import Logo from './Logo';
import { ButtonLink } from '../ui/Button';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive ? 'bg-white/10 text-gold-200' : 'text-stone-400 hover:text-stone-100'
  }`;

export default function AppShell() {
  const { pathname } = useLocation();

  // Torna in cima quando si cambia pagina
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-felt-950/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <Logo />
            <span className="font-display text-base font-bold tracking-wider whitespace-nowrap text-gold-gradient sm:text-lg">
              MTG Hand
            </span>
          </Link>
          <nav className="ml-2 hidden items-center gap-1 sm:flex">
            <NavLink to="/" end className={navClass}>
              Mazzi
            </NavLink>
            <NavLink to="/import" className={navClass}>
              Importa
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ButtonLink to="/import" variant="ghost" size="sm" className="sm:hidden">
              Importa
            </ButtonLink>
            <ButtonLink to="/new" variant="primary" size="sm">
              <span className="sm:hidden">+ Nuovo</span>
              <span className="hidden sm:inline">+ Nuovo mazzo</span>
            </ButtonLink>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="border-t border-white/5 py-6 text-center text-xs text-stone-500">
        Dati e immagini delle carte da{' '}
        <a href="https://scryfall.com" target="_blank" rel="noreferrer" className="text-stone-300 hover:text-gold-300">
          Scryfall
        </a>
        . Magic: The Gathering è un marchio di Wizards of the Coast.
      </footer>
    </div>
  );
}
