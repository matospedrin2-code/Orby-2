import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { clearHistory, fetchHistory, type HistoryItem } from "@/src/api";
import { Sheet } from "@/src/components/Sheet";
import { colors, fonts, radius, spacing } from "@/src/theme";

type Props = { visible: boolean; session: string; onClose: () => void };

export function HistorySheet({ visible, session, onClose }: Props) {
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    fetchHistory(session).then(setItems).catch((e) => setError(e.message));
  };

  useEffect(() => {
    if (visible && session) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, session]);

  return (
    <Sheet visible={visible} title="HISTÓRICO" onClose={onClose} testID="history-sheet">
      {error ? (
        <Pressable onPress={load} style={styles.center} testID="history-retry-button">
          <Text style={styles.err}>{error} · tocar para tentar de novo</Text>
        </Pressable>
      ) : !items ? (
        <ActivityIndicator color={colors.brand} style={styles.center} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(m, i) => m.id ?? String(i)}
          style={{ maxHeight: 460 }}
          contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.md }}
          ListEmptyComponent={<Text style={styles.empty} testID="history-empty">Ainda não conversamos. Diga “Orby” para começar!</Text>}
          renderItem={({ item }) => (
            <View style={[styles.msg, item.role === "user" ? styles.user : styles.orby]} testID={`history-item-${item.role}`}>
              <Text style={styles.who}>{item.role === "user" ? "VOCÊ" : item.kind === "vision" ? "ORBY · LIVE" : "ORBY"}</Text>
              <Text style={styles.txt}>{item.text}</Text>
            </View>
          )}
        />
      )}
      {!!items?.length && (
        <Pressable
          onPress={async () => {
            await clearHistory(session);
            setItems([]);
          }}
          style={styles.clear}
          testID="history-clear-button"
        >
          <Text style={styles.clearTxt}>Apagar histórico</Text>
        </Pressable>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: spacing.xxl, alignItems: "center" },
  err: { fontFamily: fonts.text, color: colors.error },
  empty: { fontFamily: fonts.text, color: colors.muted, textAlign: "center", paddingVertical: spacing.xxl },
  msg: { padding: spacing.md, borderRadius: radius.md, maxWidth: "88%" },
  user: { alignSelf: "flex-end", backgroundColor: colors.surfaceTertiary },
  orby: { alignSelf: "flex-start", backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.border },
  who: { fontFamily: fonts.displayBold, color: colors.brand, fontSize: 11, letterSpacing: 1, marginBottom: 2 },
  txt: { fontFamily: fonts.text, color: colors.onSurface, fontSize: 14, lineHeight: 20 },
  clear: { alignSelf: "center", height: 44, justifyContent: "center", paddingHorizontal: spacing.lg },
  clearTxt: { fontFamily: fonts.displayBold, color: colors.error, fontSize: 15 },
});
