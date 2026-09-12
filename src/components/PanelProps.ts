/**
 * Dieselben drei Bausteine erscheinen an zwei Stellen: als eigene Seite unter ihrer Route und
 * eingebettet im Overlay des Dashboards. Statt sie zu duplizieren, bekommen sie diese Props -
 * die Route laesst sie weg, das Overlay setzt sie.
 */
export interface PanelProps {
  /** Zieldatum fuer neue Eintraege (YYYY-MM-DD). Ohne Angabe entscheidet der Server, also heute. */
  date?: string;

  /** Statt zum Dashboard zu navigieren: Overlay schliessen und Liste neu laden. */
  onDone?: () => void;

  /** Im Overlay steht die Ueberschrift schon im Kopf - dann keine zweite im Inhalt. */
  embedded?: boolean;
}
