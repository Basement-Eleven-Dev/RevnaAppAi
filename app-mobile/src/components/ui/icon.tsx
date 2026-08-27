import Svg, { Path } from 'react-native-svg';

import { Ink } from '@/theme';

type Props = { color?: string; size?: number };

/**
 * Le icone dell'app: tratto da 1.7, estremi tondi, nessun riempimento.
 *
 * Disegnate a mano invece di prese da un pacchetto: sono dodici, e un pacchetto
 * di icone porterebbe con sé mille disegni con un altro spessore di tratto.
 */
function Line({ d, color, size = 21, width = 1.7 }: Props & { d: string[]; width?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {d.map((path) => (
        <Path
          key={path}
          d={path}
          stroke={color ?? Ink.muted}
          strokeWidth={width}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}

/** Assistente: la nuvoletta della conversazione. */
export const ChatIcon = (props: Props) => (
  <Line
    {...props}
    d={[
      'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z',
    ]}
  />
);

/** Avvisi: il megafono di chi annuncia qualcosa. */
export const AnnouncementsIcon = (props: Props) => (
  <Line
    {...props}
    d={[
      'M3 11v2a1 1 0 0 0 1 1h2l4 3.5V6.5L6 10H4a1 1 0 0 0-1 1z',
      'M14 8.5a5 5 0 0 1 0 7M17 6a8 8 0 0 1 0 12',
    ]}
  />
);

/** Documenti: il foglio con l'angolo piegato. */
export const DocumentsIcon = (props: Props) => (
  <Line
    {...props}
    d={[
      'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z',
      'M14 3v5h5M9 13h6M9 17h4',
    ]}
  />
);

/** Blog: la pagina di un articolo con le sue righe. */
export const BlogIcon = (props: Props) => (
  <Line
    {...props}
    d={['M4 5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v14a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2V5z', 'M8 7h5M8 11h5M8 15h3']}
  />
);

/** Profilo: la persona. */
export const ProfileIcon = (props: Props) => (
  <Line
    {...props}
    d={['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z']}
  />
);

/** Richieste: la cornetta di chi chiede che gli si parli. */
export const RequestsIcon = (props: Props) => (
  <Line
    {...props}
    d={[
      'M15.5 21A12.5 12.5 0 0 1 3 8.5V6a2 2 0 0 1 2-2h2.3a1 1 0 0 1 1 .8l.7 3.2a1 1 0 0 1-.5 1.1L7 10.2a10.2 10.2 0 0 0 4.9 4.9l1.1-1.5a1 1 0 0 1 1.1-.5l3.2.7a1 1 0 0 1 .8 1V17a2 2 0 0 1-2 2h-.6z',
    ]}
  />
);

/** Impostazioni: la rotella. */
export const SettingsIcon = (props: Props) => (
  <Line
    {...props}
    d={[
      'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
      'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 8.6 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 8.6a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
    ]}
  />
);

/** Menu: apre il pannello laterale. L'ultima riga più corta, come nel sistema. */
export const MenuIcon = (props: Props) => (
  <Line {...props} size={props.size ?? 15} width={2} d={['M4 7h16M4 12h16M4 17h10']} />
);

/** Invia: la freccia verso l'alto. */
export const SendIcon = (props: Props) => (
  <Line {...props} size={props.size ?? 15} width={2.4} d={['M12 19V5M12 5l-7 7M12 5l7 7']} />
);

/** Più: apre una conversazione nuova, o una richiesta. */
export const PlusIcon = (props: Props) => (
  <Line {...props} size={props.size ?? 15} width={2} d={['M12 5v14M5 12h14']} />
);

/** Indietro. */
export const BackIcon = (props: Props) => (
  <Line {...props} size={props.size ?? 15} width={2.2} d={['M15 19l-7-7 7-7']} />
);

/** Avanti: in coda a una riga che si apre. */
export const ForwardIcon = (props: Props) => (
  <Line {...props} size={props.size ?? 14} width={2.2} d={['M9 5l7 7-7 7']} />
);

/** Spunta: l'opzione attiva. */
export const CheckIcon = (props: Props) => (
  <Line {...props} size={props.size ?? 18} width={2.2} d={['M5 13l4 4L19 7']} />
);
