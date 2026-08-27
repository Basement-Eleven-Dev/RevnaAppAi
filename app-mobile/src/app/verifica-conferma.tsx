import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, ConfirmSheet, Screen, Text } from '@/components/ui';
import { Danger, Gutter, Ink, Spacing } from '@/theme';

/**
 * ROTTA TEMPORANEA DI VERIFICA — da cancellare.
 *
 * Serve a provare `ConfirmSheet` nel browser, dove l'`Alert` di React Native è una
 * funzione vuota: è esattamente il caso che era rotto.
 */
export default function VerificaConferma() {
  const [asking, setAsking] = useState<string | null>(null);
  const [esito, setEsito] = useState('nessuna conferma');

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card>
          <Text variant="section">Verifica conferma</Text>
          <View style={styles.gap}>
            <Text variant="service" color={Ink.secondary}>
              esito: {esito}
            </Text>
            <Button label="Dimentica" variant="danger" onPress={() => setAsking('una riga')} />
            <Button
              label="Cancella tutta la memoria"
              variant="danger"
              onPress={() => setAsking('tutto')}
            />
            <Text variant="tab" color={Danger.text}>
              rotta temporanea
            </Text>
          </View>
        </Card>
      </ScrollView>

      <ConfirmSheet
        visible={asking !== null}
        titolo={asking === 'tutto' ? 'Cancellare tutta la memoria?' : 'Dimenticare questo?'}
        testo={
          asking === 'tutto'
            ? 'L’assistente dimenticherà tutto quello che ha imparato su di te e ricomincerà da capo. Non si può annullare.'
            : 'L’assistente non terrà più conto di: «Non vuole elenchi puntati nelle risposte»'
        }
        conferma={asking === 'tutto' ? 'Cancella tutta la memoria' : 'Dimentica'}
        annulla="Annulla"
        onCancel={() => {
          setEsito('annullata');
          setAsking(null);
        }}
        onConfirm={() => {
          setEsito(`confermata: ${asking}`);
          setAsking(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: Gutter, paddingVertical: Spacing.xxl },
  gap: { gap: Spacing.md, marginTop: Spacing.md },
});
