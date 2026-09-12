import { useEffect, useState } from 'react';
import AiEntryPage from '../pages/AiEntryPage';
import SearchPage from '../pages/SearchPage';
import GoalsPage from '../pages/GoalsPage';

type Tab = 'text' | 'search' | 'goals';

const TABS: { id: Tab; label: string }[] = [
  { id: 'text', label: 'Per Text' },
  { id: 'search', label: 'Suche' },
  { id: 'goals', label: 'Ziele' },
];

interface Props {
  /** Tag, auf den neue Einträge gebucht werden — der, den das Dashboard gerade zeigt. */
  date: string;
  onClose: () => void;
  /** Nach erfolgreichem Eintragen: schließen und die Tagesliste neu laden. */
  onSaved: () => void;
}

/** "Freitag, 12.09." — der Tag steht im Kopf, weil man sonst still auf den falschen bucht. */
function tagText(iso: string): string {
  const [jahr, monat, tag] = iso.split('-').map(Number);
  const datum = new Date(jahr, monat - 1, tag);
  const heute = new Date();
  const istHeute =
    datum.getFullYear() === heute.getFullYear() &&
    datum.getMonth() === heute.getMonth() &&
    datum.getDate() === heute.getDate();

  if (istHeute) return 'für heute';

  return `für ${datum.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  })}`;
}

export default function EntryOverlay({ date, onClose, onSaved }: Props) {
  const [tab, setTab] = useState<Tab>('text');

  // Escape schliesst. Ohne das bliebe auf der Tastatur nur der Mausweg zum X - und ein Overlay,
  // aus dem man nicht mit Escape herauskommt, fuehlt sich kaputt an.
  useEffect(() => {
    const beiTaste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', beiTaste);
    return () => window.removeEventListener('keydown', beiTaste);
  }, [onClose]);

  // Solange das Overlay offen ist, soll die Seite dahinter nicht mitscrollen.
  useEffect(() => {
    const vorher = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = vorher; };
  }, []);

  return (
    <div
      className="overlay-backdrop"
      onClick={onClose}
      role="presentation"
    >
      {/* Klick im Inhalt darf nicht bis zum Hintergrund durchschlagen und schliessen. */}
      <div
        className="overlay-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Eintragen"
        onClick={e => e.stopPropagation()}
      >
        <div className="overlay-head">
          <div className="overlay-tabs">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={`overlay-tab${tab === id ? ' is-active' : ''}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <span className="overlay-date">{tab === 'goals' ? '' : tagText(date)}</span>

          <button type="button" className="overlay-close" onClick={onClose} aria-label="Schließen">
            ×
          </button>
        </div>

        <div className="overlay-body">
          {tab === 'text' && <AiEntryPage embedded date={date} onDone={onSaved} />}
          {tab === 'search' && <SearchPage embedded date={date} onDone={onSaved} />}
          {tab === 'goals' && <GoalsPage embedded onDone={onSaved} />}
        </div>
      </div>
    </div>
  );
}
