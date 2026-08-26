import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor, withSansFont } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  // Lo stile si appiattisce prima di scegliere il font: il peso può arrivare
  // anche da chi chiama il componente, e in Rethink Sans il peso è la famiglia.
  return (
    <Text
      style={withSansFont(
        StyleSheet.flatten([
          { color: theme[themeColor ?? 'text'] },
          type === 'default' && styles.default,
          type === 'title' && styles.title,
          type === 'small' && styles.small,
          type === 'smallBold' && styles.smallBold,
          type === 'subtitle' && styles.subtitle,
          type === 'link' && styles.link,
          type === 'linkPrimary' && styles.linkPrimary,
          type === 'code' && styles.code,
          style,
        ]),
      )}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 500,
  },
  title: {
    fontSize: 48,
    fontWeight: 600,
    lineHeight: 52,
  },
  subtitle: {
    fontSize: 32,
    lineHeight: 44,
    fontWeight: 600,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    color: '#3c87f7',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
