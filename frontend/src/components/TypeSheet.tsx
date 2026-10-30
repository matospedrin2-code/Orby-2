import { PaperPlaneRight } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Sheet } from "@/src/components/Sheet";
import { colors, fonts, radius, spacing } from "@/src/theme";

type Props = { visible: boolean; onClose: () => void; onSend: (text: string) => void };

export function TypeSheet({ visible, onClose, onSend }: Props) {
  const [text, setText] = useState("");
  const send = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
    onClose();
  };
  return (
    <Sheet visible={visible} title="FALAR COM O ORBY" onClose={onClose} testID="type-sheet">
      <View style={styles.row}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Escreva qualquer coisa..."
          placeholderTextColor={colors.muted}
          style={styles.input}
          multiline
          autoFocus
          testID="type-message-input"
          onSubmitEditing={send}
          submitBehavior="submit"
          returnKeyType="send"
        />
        <Pressable onPress={send} style={[styles.send, !text.trim() && { opacity: 0.4 }]} disabled={!text.trim()} testID="type-message-send-button">
          <PaperPlaneRight size={22} color={colors.onBrand} weight="fill" />
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 160,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceTertiary,
    color: colors.onSurface,
    paddingHorizontal: spacing.md,
    paddingTop: 13,
    paddingBottom: 13,
    fontFamily: fonts.text,
    fontSize: 15,
  },
  send: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
});
