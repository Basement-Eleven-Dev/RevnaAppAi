import { router, type Href } from 'expo-router';

/**
 * «Indietro» che porta sempre da qualche parte: dopo un refresh sul web, o
 * arrivando da un link, la cronologia è vuota e `back()` non farebbe niente.
 */
export function goBack(fallback: Href) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
