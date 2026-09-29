import { ButtonLink } from '../components/ui/Button';

export default function NotFoundPage({ message = 'Pagina non trovata' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <p className="font-display text-5xl font-bold text-gold-gradient">404</p>
      <p className="text-stone-400">{message}</p>
      <ButtonLink to="/" variant="primary">
        Torna ai mazzi
      </ButtonLink>
    </div>
  );
}
