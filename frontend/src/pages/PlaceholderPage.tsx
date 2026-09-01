import { Clock3 } from 'lucide-react';

export function PlaceholderPage({ title, phase }: { title: string; phase: string }) {
  return (
    <section className="empty-state">
      <span>
        <Clock3 size={30} />
      </span>
      <h2>{title}</h2>
      <p>Módulo em desenvolvimento. A base foi preparada sem usar dados falsos.</p>
      <small>Planejado para {phase}</small>
    </section>
  );
}
