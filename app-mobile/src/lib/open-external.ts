import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

/**
 * Una sola apertura alla volta. Il `disabled` delle righe non basta: sul web
 * arriva al `Pressable` dopo il disegno, e un doppio clic veloce lo precede.
 */
let busy = false;

/**
 * Apre una pagina fuori dall'app: il browser di sistema sul telefono, una scheda
 * nuova sul web.
 *
 * L'URL può arrivare dopo il tocco (i documenti lo chiedono al server). Sul web
 * la scheda si apre comunque subito, vuota, e riceve l'indirizzo quando c'è:
 * Safari e Firefox bloccano come popup un `window.open` che arriva dopo un'attesa
 * di rete, perché non lo considerano più parte del gesto.
 */
export async function openExternal(url: string | (() => Promise<string>)): Promise<void> {
  if (busy) return;
  busy = true;
  try {
    await open(url);
  } finally {
    busy = false;
  }
}

async function open(url: string | (() => Promise<string>)) {
  if (Platform.OS !== 'web') {
    await WebBrowser.openBrowserAsync(typeof url === 'string' ? url : await url());
    return;
  }

  // Senza dimensioni né altre opzioni: con quelle il browser apre una finestrella
  // separata invece di una scheda.
  const tab = window.open('', '_blank');
  if (tab) tab.opener = null;

  try {
    const target = typeof url === 'string' ? url : await url();
    if (tab) tab.location.href = target;
    else window.open(target, '_blank', 'noopener');
  } catch (cause) {
    tab?.close();
    throw cause;
  }
}
