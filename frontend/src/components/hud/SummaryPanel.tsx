import { Brain, X } from "phosphor-react-native";
import { useEffect, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from "react-native";
import { colors, fonts, spacing } from "@/src/theme";

export type SummaryItem = { rotulo?: string; texto: string };

type Props = { titulo: string; itens?: SummaryItem[]; texto?: string; maxHeight: number; onClose: () => void };

function toItems(itens?: SummaryItem[], texto?: string): SummaryItem[] {
  if (itens?.length) return itens;
  return (texto ?? "")
    .split(/\n+/)
    .map((t) => t.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean)
    .map((t) => {
      const m = t.match(/^([^:]{2,40}):\s*(.+)$/);
      return m ? { rotulo: m[1], texto: m[2] } : { texto: t };
    });
}

// "Resumo da pesquisa": bullet list that rolls by itself, pauses when touched.
export function SummaryPanel({ titulo, itens, texto, maxHeight, onClose }: Props) {
  const ref = useRef<ScrollViewInstance>(null);
  const y = useRef(0);
  const max = useRef(0);
  const paused = useRef(false);
  const items = toItems(itens, texto);

  useEffect(() => {
    y.current = 0;
    ref.current?.scrollTo({ y: 0, animated: false });
    let wait = 50;
    const t = setInterval(() => {
      if (paused.current || max.current <= 0) return;
      if (wait > 0) return void wait--;
      y.current += 0.6;
      if (y.current >= max.current) {
        y.current = max.current;
        wait = 70;
        setTimeout(() => {
          y.current = 0;
          ref.current?.scrollTo({ y: 0, animated: true });
        }, 3000);
      }
      ref.current?.scrollTo({ y: y.current, animated: false });
    }, 50);
    return () => clearInterval(t);
  }, [titulo, texto, itens]);

  return (
    <View testID="hud-summary">
      <View style={styles.head}>
        <Brain size={30} color={colors.brand} weight="duotone" />
        <Text style={styles.title} numberOfLines={2} testID="hud-summary-title">{titulo}</Text>
        <Pressable onPress={onClose} hitSlop={12} style={styles.close} testID="hud-close-button">
          <X size={18} color={colors.brand} weight="bold" />
        </Pressable>
      </View>
      <ScrollView
        ref={ref}
        style={{ maxHeight }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={(_, h) => (max.current = Math.max(0, h - maxHeight))}
        onScrollBeginDrag={() => (paused.current = true)}
        onScrollEndDrag={(e) => {
          y.current = e.nativeEvent.contentOffset.y;
          setTimeout(() => (paused.current = false), 2500);
        }}
      >
        <View testID="hud-summary-text">
          {items.map((it, i) => (
            <View key={i} style={styles.item}>
              <View style={styles.bullet} />
              <Text style={styles.txt}>
                {!!it.rotulo && <Text style={styles.label}>{`${it.rotulo}: `}</Text>}
                {it.texto}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md, paddingRight: 72 },
  title: { flex: 1, fontFamily: fonts.displayBold, fontSize: 22, color: colors.brand, textShadowColor: colors.brand, textShadowRadius: 8 },
  close: { position: "absolute", right: 0, top: -4, width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  item: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md, paddingRight: spacing.sm },
  bullet: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.brand, marginTop: 8 },
  txt: { flex: 1, fontFamily: fonts.text, fontSize: 14, lineHeight: 22, color: colors.brand },
  label: { color: colors.hudLabel },
});
