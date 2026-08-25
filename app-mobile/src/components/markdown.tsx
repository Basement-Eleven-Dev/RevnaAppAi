import { Fragment } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Renderer markdown minimale per le risposte dell'assistente.
 *
 * Scritto a mano invece di usare una libreria per due motivi: durante lo streaming
 * il testo è quasi sempre markdown incompleto (un `**` aperto, una lista a metà,
 * un blocco di codice non chiuso) e qui non fa alcun danno — nel peggiore dei casi
 * un marcatore resta visibile per un istante e sparisce al chunk successivo.
 *
 * Copre quello che il modello produce davvero: titoli, liste, grassetto, corsivo,
 * codice inline e a blocco, citazioni, link, righe orizzontali.
 */
export function Markdown({ text }: { text: string }) {
  return <>{parseBlocks(text).map((block, index) => renderBlock(block, index))}</>;
}

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'bullet'; items: string[] }
  | { kind: 'ordered'; items: string[] }
  | { kind: 'quote'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'rule' };

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  function flushParagraph() {
    if (paragraph.length) {
      blocks.push({ kind: 'paragraph', text: paragraph.join(' ').trim() });
      paragraph = [];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '') {
      flushParagraph();
      continue;
    }

    // Blocco di codice: se la chiusura manca (streaming in corso) si prende
    // tutto quello che resta, così il testo non scompare dalla schermata.
    if (trimmed.startsWith('```')) {
      flushParagraph();
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        body.push(lines[i]);
        i++;
      }
      blocks.push({ kind: 'code', text: body.join('\n') });
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushParagraph();
      blocks.push({ kind: 'rule' });
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2] });
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      flushParagraph();
      blocks.push({ kind: 'quote', text: trimmed.replace(/^>\s?/, '') });
      continue;
    }

    if (/^[-*+]\s+/.test(trimmed)) {
      flushParagraph();
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*+]\s+/, ''));
        i++;
      }
      i--;
      blocks.push({ kind: 'bullet', items });
      continue;
    }

    if (/^\d+[.)]\s+/.test(trimmed)) {
      flushParagraph();
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ''));
        i++;
      }
      i--;
      blocks.push({ kind: 'ordered', items });
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  return blocks;
}

function renderBlock(block: Block, key: number) {
  switch (block.kind) {
    case 'heading':
      return <Heading key={key} level={block.level} text={block.text} />;
    case 'paragraph':
      return (
        <ThemedText key={key} type="small" style={styles.paragraph}>
          <Inline text={block.text} />
        </ThemedText>
      );
    case 'bullet':
      return <List key={key} items={block.items} />;
    case 'ordered':
      return <List key={key} items={block.items} ordered />;
    case 'quote':
      return <Quote key={key} text={block.text} />;
    case 'code':
      return <CodeBlock key={key} text={block.text} />;
    case 'rule':
      return <Rule key={key} />;
  }
}

function Heading({ level, text }: { level: number; text: string }) {
  const size = level <= 1 ? 20 : level === 2 ? 18 : 16;
  return (
    <ThemedText type="smallBold" style={[styles.heading, { fontSize: size, lineHeight: size + 8 }]}>
      <Inline text={text} />
    </ThemedText>
  );
}

function List({ items, ordered = false }: { items: string[]; ordered?: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.list}>
      {items.map((item, index) => (
        <View key={index} style={styles.listItem}>
          <ThemedText type="small" style={[styles.bullet, { color: theme.primary }]}>
            {ordered ? `${index + 1}.` : '•'}
          </ThemedText>
          <ThemedText type="small" style={styles.listText}>
            <Inline text={item} />
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

function Quote({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.quote, { borderLeftColor: theme.primary }]}>
      <ThemedText type="small" themeColor="textSecondary">
        <Inline text={text} />
      </ThemedText>
    </View>
  );
}

function CodeBlock({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.codeBlock, { borderColor: theme.border }]}>
      <ThemedText type="small" style={styles.mono}>
        {text}
      </ThemedText>
    </View>
  );
}

function Rule() {
  const theme = useTheme();
  return <View style={[styles.rule, { backgroundColor: theme.border }]} />;
}

type Span = { text: string; bold?: boolean; italic?: boolean; code?: boolean; href?: string };

// Un solo passaggio per tutti i marcatori inline: l'ordine conta, `**` va provato
// prima di `*`, altrimenti il grassetto verrebbe letto come due corsivi vuoti.
const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(\[[^\]]+\]\([^)]+\))/;

function parseInline(text: string): Span[] {
  const spans: Span[] = [];
  let rest = text;

  while (rest.length > 0) {
    const match = INLINE.exec(rest);
    if (!match || match.index === undefined) {
      spans.push({ text: rest });
      break;
    }

    if (match.index > 0) spans.push({ text: rest.slice(0, match.index) });

    const token = match[0];
    if (token.startsWith('`')) {
      spans.push({ text: token.slice(1, -1), code: true });
    } else if (token.startsWith('**') || token.startsWith('__')) {
      spans.push({ text: token.slice(2, -2), bold: true });
    } else if (token.startsWith('[')) {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      spans.push({ text: link?.[1] ?? token, href: link?.[2] });
    } else {
      spans.push({ text: token.slice(1, -1), italic: true });
    }

    rest = rest.slice(match.index + token.length);
  }

  return spans;
}

function Inline({ text }: { text: string }) {
  const theme = useTheme();

  return (
    <>
      {parseInline(text).map((span, index) => (
        <Fragment key={index}>
          <Text
            style={[
              span.bold && styles.bold,
              span.italic && styles.italic,
              span.code && [styles.mono, styles.inlineCode, { color: theme.primary }],
              span.href !== undefined && [styles.link, { color: theme.primary }],
            ]}
            onPress={span.href ? () => Linking.openURL(span.href as string) : undefined}>
            {span.text}
          </Text>
        </Fragment>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  paragraph: { marginBottom: Spacing.two },
  heading: { marginTop: Spacing.two, marginBottom: Spacing.one },
  list: { marginBottom: Spacing.two, gap: Spacing.one },
  listItem: { flexDirection: 'row', gap: Spacing.two },
  bullet: { fontWeight: '700', minWidth: 16 },
  listText: { flex: 1 },
  quote: {
    borderLeftWidth: 3,
    paddingLeft: Spacing.three,
    marginBottom: Spacing.two,
  },
  codeBlock: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  rule: { height: 1, marginVertical: Spacing.three },
  mono: { fontFamily: Fonts.mono, fontSize: 13 },
  inlineCode: { fontSize: 13 },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  link: { textDecorationLine: 'underline' },
});
