import { StyleSheet } from 'react-native';

import { Appear, SourceChip } from '@/components/ui';
import type { Source } from '@/hooks/use-conversations';
import { Spacing } from '@/theme';

/**
 * Il materiale Revna su cui poggia una risposta, come chip numerati.
 *
 * I numeri sono gli stessi marcatori che il modello mette in apice dentro il
 * testo: si risale da una singola affermazione alla sua fonte, non solo dalla
 * risposta nel suo insieme. Sta sotto la risposta e non sopra perché non è un
 * disclaimer, è una firma.
 *
 * I chip non sono ancora toccabili: la fonte che arriva dal backend porta un
 * numero e un titolo, non il riferimento al documento da aprire (vedi le note di
 * consegna del riallineamento).
 *
 * La firma entra in scena: arriva a risposta finita, sotto un testo che si è appena
 * fermato di scrivere, e comparire di colpo lì sarebbe indistinguibile da un salto
 * del layout.
 */
export function Sources({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;

  return (
    <Appear style={styles.row}>
      {sources.map((source) => (
        <SourceChip key={source.n} n={source.n} label={source.titolo} />
      ))}
    </Appear>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm - 1,
    marginTop: Spacing.md + 2,
  },
});
