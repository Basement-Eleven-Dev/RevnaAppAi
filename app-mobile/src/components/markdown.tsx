import { Image } from 'expo-image';
import { Fragment, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Bevel, SourceMarker, Text } from '@/components/ui';
import { Brand, Corner, Family, Ink, Line, Spacing, Surface } from '@/theme';

/**
 * Renderer markdown minimale per le risposte dell'assistente e per gli avvisi.
 *
 * Scritto a mano invece di usare una libreria per due motivi: durante lo streaming
 * il testo è quasi sempre markdown incompleto (un `**` aperto, una lista a metà,
 * un blocco di codice non chiuso) e qui non fa alcun danno — nel peggiore dei casi
 * un marcatore resta visibile per un istante e sparisce al chunk successivo.
 *
 * Copre quello che il modello produce davvero: titoli, liste, grassetto, corsivo,
 * codice inline e a blocco, citazioni, link, righe orizzontali.
 *
 * Le immagini invece l'assistente non le produce: servono agli **avvisi**, scritti dal
 * backoffice con un editor che può metterne. Stanno qui e non in un renderer a parte
 * perché il resto di un avviso sono esattamente questi blocchi: due renderer per lo
 * stesso markdown vorrebbero dire due modi in cui un titolo può apparire nell'app.
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
  | { kind: 'image'; url: string; alt: string }
  | { kind: 'rule' };

/** Un'immagine da sola su una riga: è così che l'editor del backoffice la scrive. */
const IMAGE_LINE = /^!\[([^\]]*)]\(([^)]+)\)$/;

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

    const image = IMAGE_LINE.exec(trimmed);
    if (image) {
      flushParagraph();
      blocks.push({ kind: 'image', alt: image[1], url: image[2] });
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
        <Text key={key} variant="body" style={styles.paragraph}>
          <Inline text={block.text} />
        </Text>
      );
    case 'bullet':
      return <List key={key} items={block.items} />;
    case 'ordered':
      return <List key={key} items={block.items} ordered />;
    case 'quote':
      return <Quote key={key} text={block.text} />;
    case 'code':
      return <CodeBlock key={key} text={block.text} />;
    case 'image':
      return <MarkdownImage key={key} url={block.url} alt={block.alt} />;
    case 'rule':
      return <Rule key={key} />;
  }
}

/**
 * I titoli dentro il testo usano i due ruoli che il sistema ha: `section` per il
 * primo livello, `rowTitle` per quelli sotto. Non c'è una scala di sei misure —
 * dentro un avviso non servono sei livelli di gerarchia.
 */
function Heading({ level, text }: { level: number; text: string }) {
  return (
    <Text variant={level <= 2 ? 'section' : 'rowTitle'} style={styles.heading}>
      <Inline text={text} />
    </Text>
  );
}

function List({ items, ordered = false }: { items: string[]; ordered?: boolean }) {
  return (
    <View style={styles.list}>
      {items.map((item, index) => (
        <View key={index} style={styles.listItem}>
          <Text variant="body" color={Brand.accent} style={styles.bullet}>
            {ordered ? `${index + 1}.` : '•'}
          </Text>
          <Text variant="body" style={styles.listText}>
            <Inline text={item} />
          </Text>
        </View>
      ))}
    </View>
  );
}

function Quote({ text }: { text: string }) {
  return (
    <View style={styles.quote}>
      <Text variant="body" color={Ink.secondary}>
        <Inline text={text} />
      </Text>
    </View>
  );
}

function CodeBlock({ text }: { text: string }) {
  return (
    <Bevel radius={Corner.control} fill={Surface.card} style={styles.codeBlock}>
      <Text variant="body" color={Ink.secondary} style={styles.mono}>
        {text}
      </Text>
    </Bevel>
  );
}

/**
 * Un'immagine dentro il testo, a piena larghezza.
 *
 * Le proporzioni si prendono dall'immagine appena è caricata, invece di imporne uno:
 * in un avviso ci finisce di tutto — la schermata di un cruscotto, un grafico, una foto
 * verticale — e ritagliare in un rapporto scelto da noi taglierebbe via il numero di cui
 * si sta parlando. Fino a quel momento tiene il posto un rettangolo 3:2, così il testo
 * sotto non salta quando l'immagine arriva.
 */
function MarkdownImage({ url, alt }: { url: string; alt: string }) {
  const [ratio, setRatio] = useState(3 / 2);

  return (
    <Bevel radius={Corner.card} mask={Surface.base} style={styles.imageWrap}>
      <Image
        source={url}
        accessibilityLabel={alt}
        style={[styles.image, { aspectRatio: ratio }]}
        contentFit="cover"
        transition={180}
        onLoad={({ source }) => {
          if (source.width > 0 && source.height > 0) setRatio(source.width / source.height);
        }}
      />
    </Bevel>
  );
}

function Rule() {
  return <View style={styles.rule} />;
}

type Span = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  href?: string;
  /** Il numero di una fonte citata: `[1]` dentro la risposta. */
  source?: number;
};

// Un solo passaggio per tutti i marcatori inline: l'ordine conta. `**` va provato
// prima di `*`, altrimenti il grassetto verrebbe letto come due corsivi vuoti; e il
// link va provato prima del marcatore di fonte, perché `[1](url)` è un link e `[1]`
// da solo è una citazione.
const INLINE =
  /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(\[[^\]]+\]\([^)]+\))|(\[\d{1,2}\])/;

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
      if (link) {
        spans.push({ text: link[1], href: link[2] });
      } else {
        spans.push({ text: token, source: Number(token.slice(1, -1)) });
      }
    } else {
      spans.push({ text: token.slice(1, -1), italic: true });
    }

    rest = rest.slice(match.index + token.length);
  }

  return spans;
}

/**
 * Il peso e il corsivo stanno nel nome della famiglia e non in `fontWeight`: su una
 * famiglia già del peso giusto il sistema metterebbe sopra un finto grassetto.
 *
 * I marcatori `[1]` che il modello mette accanto a un'affermazione diventano il
 * numero della fonte in accento — gli stessi numeri dei chip in fondo alla
 * risposta, così si risale dalla singola frase al materiale che la sostiene.
 */
function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((span, index) => (
        <Fragment key={index}>
          {span.source !== undefined ? (
            <SourceMarker n={span.source} />
          ) : (
            <Text
              variant="body"
              color={span.code || span.href !== undefined ? Brand.accentSoft : undefined}
              style={[
                span.bold && styles.bold,
                span.italic && styles.italic,
                span.code && styles.mono,
                span.href !== undefined && styles.link,
              ]}
              onPress={span.href ? () => Linking.openURL(span.href as string) : undefined}>
              {span.text}
            </Text>
          )}
        </Fragment>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  // Misura da articolo: nel corpo di un avviso si legge a interlinea più larga
  // di quella di una descrizione in elenco.
  paragraph: { lineHeight: 25, marginBottom: Spacing.sm },
  heading: { marginTop: Spacing.lg, marginBottom: Spacing.sm - 2 },
  list: { marginBottom: Spacing.sm, gap: Spacing.xs },
  listItem: { flexDirection: 'row', gap: Spacing.sm },
  bullet: { fontFamily: Family.sansBold, minWidth: 16 },
  listText: { flex: 1 },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: Brand.accent,
    paddingLeft: Spacing.md,
    marginBottom: Spacing.sm,
  },
  codeBlock: { padding: Spacing.md, marginBottom: Spacing.sm },
  rule: { height: 1, marginVertical: Spacing.lg, backgroundColor: Line.hairline },
  imageWrap: { marginBottom: Spacing.lg },
  image: { width: '100%', backgroundColor: Surface.card },
  mono: { fontFamily: Family.mono, fontSize: 13 },
  bold: { fontFamily: Family.sansBold },
  italic: { fontFamily: Family.sansItalic },
  link: { textDecorationLine: 'underline' },
});
