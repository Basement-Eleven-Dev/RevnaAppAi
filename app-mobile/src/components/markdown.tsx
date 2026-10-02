import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { Fragment, useState } from 'react';
import { Linking, Text as RNText, StyleSheet, View } from 'react-native';

import { Bevel, ErrorNote, SourceMarker, Text } from '@/components/ui';
import { useT } from '@/hooks/use-language';
import { errorMessage } from '@/lib/i18n/errors';
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
  const t = useT();
  const [linkError, setLinkError] = useState<{ block: number; cause: unknown } | null>(null);

  // L'errore compare sotto il blocco del link toccato: in fondo a un avviso lungo
  // nessuno lo vedrebbe.
  return (
    <>
      {parseBlocks(text).map((block, index) => (
        <Fragment key={index}>
          {renderBlock(block, (href) => {
            setLinkError(null);
            openLink(href).catch((cause: unknown) => setLinkError({ block: index, cause }));
          })}
          {linkError?.block === index && (
            <View style={styles.linkError}>
              <ErrorNote>{errorMessage(t, linkError.cause, t.comune.linkNonApribile)}</ErrorNote>
            </View>
          )}
        </Fragment>
      ))}
    </>
  );
}

type OnLink = (href: string) => void;

/** Gli unici schemi che un link può aprire: il testo arriva dal modello e dal backoffice. */
const SAFE_LINK = /^(https|mailto|tel):/i;

function safeLink(href: string): string | undefined {
  const url = href.trim();
  return SAFE_LINK.test(url) ? url : undefined;
}

/** Le pagine web nel browser interno all'app; email e telefono nell'app che li gestisce. */
function openLink(href: string): Promise<unknown> {
  return /^https:/i.test(href) ? WebBrowser.openBrowserAsync(href) : Linking.openURL(href);
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

function renderBlock(block: Block, onLink: OnLink) {
  switch (block.kind) {
    case 'heading':
      return <Heading level={block.level} text={block.text} onLink={onLink} />;
    case 'paragraph':
      return (
        <Text variant="body" style={styles.paragraph}>
          <Inline text={block.text} onLink={onLink} />
        </Text>
      );
    case 'bullet':
      return <List items={block.items} onLink={onLink} />;
    case 'ordered':
      return <List items={block.items} onLink={onLink} ordered />;
    case 'quote':
      return <Quote text={block.text} onLink={onLink} />;
    case 'code':
      return <CodeBlock text={block.text} />;
    case 'image':
      return <MarkdownImage url={block.url} alt={block.alt} />;
    case 'rule':
      return <Rule />;
  }
}

/**
 * I titoli dentro il testo usano i due ruoli che il sistema ha: `section` per il
 * primo livello, `rowTitle` per quelli sotto. Non c'è una scala di sei misure —
 * dentro un avviso non servono sei livelli di gerarchia.
 */
function Heading({ level, text, onLink }: { level: number; text: string; onLink: OnLink }) {
  return (
    <Text variant={level <= 2 ? 'section' : 'rowTitle'} style={styles.heading}>
      <Inline text={text} onLink={onLink} />
    </Text>
  );
}

function List({
  items,
  onLink,
  ordered = false,
}: {
  items: string[];
  onLink: OnLink;
  ordered?: boolean;
}) {
  return (
    <View style={styles.list}>
      {items.map((item, index) => (
        <View key={index} style={styles.listItem}>
          <Text variant="body" color={Brand.accent} style={styles.bullet}>
            {ordered ? `${index + 1}.` : '•'}
          </Text>
          <Text variant="body" style={styles.listText}>
            <Inline text={item} onLink={onLink} />
          </Text>
        </View>
      ))}
    </View>
  );
}

function Quote({ text, onLink }: { text: string; onLink: OnLink }) {
  return (
    <View style={styles.quote}>
      <Text variant="body" color={Ink.secondary}>
        <Inline text={text} onLink={onLink} />
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
        spans.push({ text: link[1], href: safeLink(link[2]) });
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
 * I pezzi sono `Text` di React Native senza ruolo: misura, interlinea e colore li
 * prendono dal blocco che li contiene, titolo o citazione che sia. Qui si aggiunge
 * solo quello che il marcatore cambia.
 *
 * Il peso e il corsivo stanno nel nome della famiglia e non in `fontWeight`: su una
 * famiglia già del peso giusto il sistema metterebbe sopra un finto grassetto.
 *
 * Un link con uno schema non ammesso resta testo semplice: si legge, non si tocca.
 *
 * I marcatori `[1]` che il modello mette accanto a un'affermazione diventano il
 * numero della fonte in accento — gli stessi numeri dei chip in fondo alla
 * risposta, così si risale dalla singola frase al materiale che la sostiene.
 */
function Inline({ text, onLink }: { text: string; onLink: OnLink }) {
  return (
    <>
      {parseInline(text).map((span, index) => (
        <Fragment key={index}>
          {span.source !== undefined ? (
            <SourceMarker n={span.source} />
          ) : (
            <RNText
              style={[
                span.bold && styles.bold,
                span.italic && styles.italic,
                span.code && styles.mono,
                (span.code || span.href !== undefined) && styles.accent,
                span.href !== undefined && styles.link,
              ]}
              accessibilityRole={span.href !== undefined ? 'link' : undefined}
              onPress={span.href !== undefined ? () => onLink(span.href as string) : undefined}>
              {span.text}
            </RNText>
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
  accent: { color: Brand.accentSoft },
  link: { textDecorationLine: 'underline' },
  linkError: { marginBottom: Spacing.sm },
});
