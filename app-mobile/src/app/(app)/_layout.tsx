import { Redirect } from 'expo-router';
import Drawer from 'expo-router/drawer';
import { signOut } from 'firebase/auth';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppSidebar, SIDEBAR_MAX_WIDTH } from '@/components/app-sidebar';
import { Wordmark } from '@/components/brand/wordmark';
import { Button, FormScreen, Loading, ScreenBar, Text } from '@/components/ui';
import { AnnouncementsProvider } from '@/hooks/use-announcements';
import { AssistantProvider } from '@/hooks/use-assistant';
import { useAuth, useIsRevnaAdmin } from '@/hooks/use-auth';
import { useT } from '@/hooks/use-language';
import { getFirebaseAuth } from '@/lib/firebase';
import { Gutter, Ink, Spacing, Surface } from '@/theme';

/**
 * Area riservata: senza sessione non si entra, e un referente Revna si ferma prima.
 *
 * La navigazione ha due piani, e non è una ridondanza. In fondo, la **tab bar**
 * con le cinque sezioni: si passa da una all'altra con il pollice, senza aprire
 * niente. Dietro, il **pannello laterale**, che tiene le cose che in una tab bar
 * non stanno — lo storico delle conversazioni, che è ciò che si apre più spesso, e
 * le due voci di servizio (richieste e impostazioni).
 *
 * Il Drawer sta quindi sopra tutto, e dentro ha un solo figlio: lo Stack di
 * `(main)`, che è dove le schermate di dettaglio si impilano sopra le tab.
 */
export default function AppLayout() {
  const { user, loading } = useAuth();
  const admin = useIsRevnaAdmin(user);
  const { width } = useWindowDimensions();

  if (loading || (user && admin === null)) {
    return <Loading fill />;
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  // Prima dei provider: un referente non deve nemmeno registrare il telefono alle
  // notifiche dei clienti.
  if (admin) return <ClientsOnly />;

  return (
    // Gli avvisi stanno sopra la navigazione e non dentro una schermata: il contatore
    // dei non letti si vede nella tab bar da qualsiasi sezione, e le notifiche vanno
    // registrate all'ingresso nell'area riservata — non quando si apre la sezione, che
    // chi non ha mai avuto un avviso non aprirebbe mai.
    <AnnouncementsProvider>
      <AssistantProvider>
        {/* Col pannello aperto la schermata scivola fuori a destra: sul web, senza
            un contenitore che la tagli, la pagina si allarga e il telefono la
            rimpicciolisce, fogli di conferma compresi. */}
        <View style={styles.clip}>
          <Drawer
            drawerContent={(props) => <AppSidebar {...props} />}
            screenOptions={{
              headerShown: false,
              // `slide` su entrambe le piattaforme: vedere la schermata spinta via dice
              // cosa sta succedendo meglio di un pannello che ci si sovrappone.
              drawerType: 'slide',
              drawerStyle: {
                backgroundColor: Surface.raised,
                width: Math.min(SIDEBAR_MAX_WIDTH, width * 0.84),
              },
              overlayColor: 'rgba(6,5,5,0.6)',
              swipeEdgeWidth: 48,
            }}
          />
        </View>
      </AssistantProvider>
    </AnnouncementsProvider>
  );
}

/** Il rifiuto per chi entra con un account del team Revna: spiega e fa uscire. */
function ClientsOnly() {
  const t = useT();
  const [busy, setBusy] = useState(false);

  async function esci() {
    setBusy(true);
    await signOut(getFirebaseAuth()).catch(() => setBusy(false));
  }

  return (
    <FormScreen>
      <ScreenBar />

      <View style={styles.hero}>
        <Wordmark width={112} />
        <Text variant="title" style={styles.title}>
          {t.soloClienti.titolo}
        </Text>
      </View>

      <View style={styles.spacer} />

      <View style={styles.form}>
        <Text variant="service" color={Ink.secondary} style={styles.help}>
          {t.soloClienti.testo}
        </Text>
        <Button
          label={t.profilo.esci}
          loading={busy}
          loadingLabel={t.profilo.uscita.inCorso}
          onPress={() => void esci()}
        />
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  clip: { flex: 1, overflow: 'hidden' },
  hero: { paddingHorizontal: Gutter + 2 },
  spacer: { flex: 1 },
  title: { marginTop: Spacing.xl },
  form: { paddingHorizontal: Gutter + 2, paddingBottom: Spacing.huge - 4, gap: Spacing.md - 1 },
  help: { lineHeight: 20 },
});
