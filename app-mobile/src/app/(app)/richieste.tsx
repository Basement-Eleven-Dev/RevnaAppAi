import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ContactRequestModal } from '@/components/contact-request-modal';
import { MenuButton } from '@/components/menu-button';
import { NewChatIcon, RequestsIcon } from '@/components/tab-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { createContactRequest, useContactRequests } from '@/hooks/use-contact-requests';
import { useT } from '@/hooks/use-language';
import { useTheme } from '@/hooks/use-theme';
import type { ContactRequest, Stato } from '@/lib/contact-requests';
import type { Dictionary } from '@/lib/i18n';

/**
 * Le richieste di contatto del cliente, e da dove se ne apre una.
 *
 * Esiste per due motivi diversi. Il primo è che una richiesta, dopo averla mandata,
 * bisogna poterla ritrovare: nella chat scorre via con la conversazione, e senza un
 * posto dove sta scritto «inviata, visualizzata, chiusa» il cliente non sa se
 * qualcuno l'ha presa in mano. Il secondo è che non tutto nasce da una domanda
 * all'assistente — a volte si vuole parlare con una persona e basta, e quella strada
 * non deve passare per una chat.
 */
export default function RequestsScreen() {
  const theme = useTheme();
  const t = useT();
  const { requests, loading, error } = useContactRequests();
  const [composing, setComposing] = useState(false);
  /**
   * Cambia a ogni richiesta inviata, per rimontare la modale su un foglio bianco:
   * senza questo la seconda richiesta partirebbe dal testo della prima.
   */
  const [foglio, setFoglio] = useState(0);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.topbar}>
          <MenuButton />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <ThemedText type="subtitle">{t.richieste.titolo}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t.richieste.sottotitolo}
            </ThemedText>
          </View>

          <Pressable
            onPress={() => setComposing(true)}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.nuova,
              { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
            ]}>
            <NewChatIcon color="#FFFFFF" size={18} />
            <ThemedText type="smallBold" style={styles.nuovaLabel}>
              {t.richieste.nuova}
            </ThemedText>
          </Pressable>

          {loading && <ActivityIndicator color={theme.primary} />}

          {!loading && requests.length === 0 && (
            <ThemedView type="backgroundElement" style={styles.empty}>
              <RequestsIcon color={theme.textSecondary} size={32} />
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                {t.richieste.vuoto}
              </ThemedText>
            </ThemedView>
          )}

          {error !== '' && (
            <ThemedText type="small" style={styles.error}>
              {error}
            </ThemedText>
          )}

          {requests.map((request) => (
            <RequestCard key={request.id} request={request} />
          ))}
        </ScrollView>
      </SafeAreaView>

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
    </ThemedView>
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
function RequestCard({ request }: { request: ContactRequest }) {
  const theme = useTheme();
  const t = useT();
  const recapito = request.contatto.telefono || request.contatto.email;

  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
      <View style={styles.cardHead}>
        <View
          style={[
            styles.badge,
            { borderColor: statoColor(request.stato, theme.primary, theme.border) },
          ]}>
          <ThemedText
            type="small"
            themeColor={request.stato === 'chiusa' ? 'textSecondary' : 'primary'}
            style={styles.badgeLabel}>
            {t.richieste.stati[request.stato]}
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={styles.meta}>
          {t.richieste.aperta(shortDate(request.createdAt, t))}
        </ThemedText>
      </View>

      <ThemedText type="small">{request.messaggio}</ThemedText>

      <ThemedText type="small" themeColor="textSecondary" style={styles.stato}>
        {t.richieste.statiAiuto[request.stato]}
      </ThemedText>

      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        {recapito !== '' && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.meta}>
            {t.richieste.richiamoSu(recapito)}
          </ThemedText>
        )}
        <ThemedText type="small" themeColor="textSecondary" style={styles.meta}>
          {t.richieste.origine[request.origine]}
        </ThemedText>
      </View>
    </ThemedView>
  );
}

/** Una richiesta chiusa non deve più chiamare l'occhio: il bordo si spegne. */
function statoColor(stato: Stato, primary: string, border: string): string {
  return stato === 'chiusa' ? border : primary;
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
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  topbar: { flexDirection: 'row', paddingHorizontal: Spacing.four },
  scroll: { padding: Spacing.four, gap: Spacing.three },
  header: { gap: Spacing.one },
  nuova: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: 46,
    borderRadius: 23,
  },
  nuovaLabel: { color: '#FFFFFF' },
  empty: {
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.five,
    borderRadius: Spacing.four,
  },
  emptyText: { textAlign: 'center', lineHeight: 20 },
  error: { color: '#B3261E' },
  card: {
    gap: Spacing.two,
    padding: Spacing.four,
    borderRadius: Spacing.four,
    borderWidth: 1,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    backgroundColor: 'transparent',
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
  },
  badgeLabel: { fontSize: 11, lineHeight: 16, fontWeight: '600' },
  meta: { fontSize: 11 },
  stato: { lineHeight: 18 },
  footer: {
    gap: Spacing.half,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    backgroundColor: 'transparent',
  },
});
