import { useColorScheme } from 'react-native';

import LogoOnDark from '@/assets/images/brand/logo_light.svg';
import LogoOnLight from '@/assets/images/brand/logo_dark.svg';

const ASPECT_RATIO = 522 / 185;

type Props = {
  /** Larghezza in px; l'altezza segue le proporzioni del logo. */
  width?: number;
};

/** Logo Revna completo, con la variante giusta per il tema chiaro o scuro. */
export function BrandLogo({ width = 200 }: Props) {
  const Logo = useColorScheme() === 'dark' ? LogoOnDark : LogoOnLight;

  return <Logo width={width} height={width / ASPECT_RATIO} />;
}
