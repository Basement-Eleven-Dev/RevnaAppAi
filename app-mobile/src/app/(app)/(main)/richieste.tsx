import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { ContactRequestModal } from '@/components/contact-request-modal';
import {
  Appear,
  BackIcon,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  IconButton,
  PageHeading,
  RequestsIcon,
  Screen,
  ScreenBar,
  stagger,
  StatusChip,
  Text,
  type ChipTone,
} from '@/components/ui';
import { createContactRequest, useContactRequests } from '@/hooks/use-contact-requests';
import { useT } from '@/hooks/use-language';
import type { ContactRequest, Stato } from '@/lib/contact-requests';
import type { Dictionary } from '@/lib/i18n';
import { Gutter, Ink, Line, Spacing } from '@/theme';

/**
 * Le richieste di contatto del cliente, e da dove se ne apre una.
 *
 * Esiste per due motivi diversi. Il primo è che una richiesta, dopo averla
 * mandata, bisogna poterla ritrovare: nella chat scorre via con la conversazione,
 * e senza un posto dove sta scritto «inviata, visualizzata, chiusa» il cliente non
 * sa se qualcuno l'ha presa in mano. Il secondo è che non tutto nasce da una
 * domanda all'assistente — a volte si vuole parlare con una persona e basta, e
 * quella strada non deve passare per una chat.
 *
 * Sta nel pannello laterale e non nella tab bar: è la sezione che si apre quando
 * si sta aspettando una risposta, non una delle cinque in cui si vive.
 */
export default function RequestsScreen() {
  const t = useT();
  const router = useRouter();
  const { requests, loading, error } = useContactRequests();
  const [composing, setComposing] = useState(false);
  /**
   * Cambia a ogni richiesta inviata, per rimontare la modale su un foglio bianco:
   * senza questo la seconda richiesta partirebbe dal testo della prima.
   */
  const [foglio, setFoglio] = useState(0);

  return (
    <Screen>
      <ScreenBar
        left={
          <IconButton onPress={() => router.back()} accessibilityLabel={t.comune.indietro}>
            <BackIcon color={Ink.secondary} />
          </IconButton>
        }
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        <PageHeading title={t.richieste.titolo} subtitle={t.richieste.sottotitolo} />

        <Button label={t.richieste.nuova} onPress={() => setComposing(true)} />

        {loading && <ActivityIndicator color={Ink.faint} />}

        {error !== '' && <ErrorNote>{error}</ErrorNote>}

        {!loading && requests.length === 0 && (
          <EmptyState icon={<RequestsIcon color={Ink.faint} size={32} />} text={t.richieste.vuoto} />
        )}

        {requests.map((request, index) => (
          <Appear key={request.id} delay={stagger(index)}>
            <RequestCard request={request} t={t} />
          </Appear>
        ))}
      </ScrollView>

      <ContactRequestModal
        key={foglio}
        visible={composing}
        onClose={() => setComposing(false)}
        onConfirm={async (messaggio) => {
          await createContactRequest({ messaggio });
          setComposing(false);
          setFoglio((numero) => numero + 1);
        }}
      />
    </Screen>
  );
}

/**
 * Una richiesta in elenco.
 *
 * Lo stato sta in cima con la sua riga di spiegazione: «visualizzata» da solo non
 * dice a nessuno cosa stia succedendo, e questa schermata si apre proprio per
 * saperlo. Sotto il testo c'è il recapito con cui la richiesta è partita, che è la
 * risposta alla seconda domanda di chi aspetta una chiamata: dove mi chiamano.
 */
function RequestCard({ request, t }: { request: ContactRequest; t: Dictionary }) {
  const recapito = request.contatto.telefono || request.contatto.email;

  return (
    <Card>
      <View style={styles.head}>
        <StatusChip label={t.richieste.stati[request.stato]} tone={toneOf(request.stato)} />
        <Text variant="tab" color={Ink.faint}>
          {t.richieste.aperta(shortDate(request.createdAt, t))}
        </Text>
      </View>

      <Text variant="service" color={Ink.primary} style={styles.message}>
        {request.messaggio}
      </Text>

      <Text variant="service" color={Ink.secondary}>
        {t.richieste.statiAiuto[request.stato]}
      </Text>

      <View style={styles.footer}>
        {recapito !== '' && (
          <Text variant="tab" color={Ink.faint}>
            {t.richieste.richiamoSu(recapito)}
          </Text>
        )}
        <Text variant="tab" color={Ink.ghost}>
          {t.richieste.origine[request.origine]}
        </Text>
      </View>
    </Card>
  );
}

/** Una richiesta chiusa non deve più chiamare l'occhio: lo stato si spegne. */
function toneOf(stato: Stato): ChipTone {
  if (stato === 'inviata') return 'accent';
  if (stato === 'visualizzata') return 'neutral';
  return 'quiet';
}

function shortDate(iso: string, t: Dictionary): string {
  return iso
    ? new Date(iso).toLocaleDateString(t.dateLocale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: Gutter, paddingBottom: Spacing.xxl, gap: Spacing.sm + 2 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  message: { marginBottom: Spacing.sm },
  footer: {
    gap: Spacing.hair,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Line.hairline,
  },
});
