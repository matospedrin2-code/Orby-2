import { ClockCounterClockwise, Keyboard, Smiley, Trash } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import type { Settings } from "@/src/api";
import { Sheet } from "@/src/components/Sheet";
import { colors, fonts, radius, spacing } from "@/src/theme";

const VOICES = [
  { id: "verse", label: "Verse (viva)" },
  { id: "coral", label: "Coral (calorosa)" },
  { id: "nova", label: "Nova (animada)" },
  { id: "shimmer", label: "Shimmer (brilhante)" },
  { id: "ash", label: "Ash (clara)" },
  { id: "ballad", label: "Ballad (suave)" },
  { id: "fable", label: "Fable (expressiva)" },
  { id: "sage", label: "Sage (calma)" },
];
const PAUSES = [
  { id: "curta", label: "Curta" },
  { id: "media", label: "Média" },
  { id: "longa", label: "Longa" },
] as const;

type Props = {
  visible: boolean;
  settings: Settings;
  trackingAvailable: boolean;
  continuousOk: boolean;
  onChange: (s: Partial<Settings>) => void;
  onClose: () => void;
  onHistory: () => void;
  onType: () => void;
  onGallery: () => void;
  onClearMemories: () => void;
  onTestVoice: () => void;
};

function Chips<T extends string>({ items, value, onPick, prefix }: { items: readonly { id: T; label: string }[]; value: T; onPick: (v: T) => void; prefix: string }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipRow}>
      {items.map((it) => (
        <Pressable
          key={it.id}
          onPress={() => onPick(it.id)}
          style={[styles.chip, value === it.id && styles.chipOn]}
          testID={`${prefix}-${it.id}`}
        >
          <Text style={[styles.chipTxt, value === it.id && styles.chipTxtOn]}>{it.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function Row({ label, hint, value, onChange, testID, disabled }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; testID: string; disabled?: boolean }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, disabled && { opacity: 0.5 }]}>{label}</Text>
        {!!hint && <Text style={styles.hint}>{hint}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: colors.brandSecondary, false: colors.surfaceTertiary }}
        thumbColor={value ? colors.brand : colors.muted}
        testID={testID}
      />
    </View>
  );
}

export function SettingsSheet(p: Props) {
  const [name, setName] = useState(p.settings.name);
  return (
    <Sheet visible={p.visible} title="AJUSTES DO ORBY" onClose={() => { p.onChange({ name: name.trim() }); p.onClose(); }} testID="settings-sheet">
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.btnRow}>
          <Pressable onPress={p.onType} style={styles.ghostBtn} testID="type-message-button">
            <Keyboard size={18} color={colors.brand} />
            <Text style={styles.ghostTxt}>Digitar mensagem</Text>
          </Pressable>
          <Pressable onPress={p.onHistory} style={styles.ghostBtn} testID="settings-history-top-button">
            <ClockCounterClockwise size={18} color={colors.brand} />
            <Text style={styles.ghostTxt}>Histórico</Text>
          </Pressable>
          <Pressable onPress={p.onGallery} style={styles.ghostBtn} testID="settings-gallery-button">
            <Smiley size={18} color={colors.brand} />
            <Text style={styles.ghostTxt}>Expressões</Text>
          </Pressable>
        </View>
        <Text style={styles.section}>Como devo te chamar?</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          onBlur={() => p.onChange({ name: name.trim() })}
          placeholder="Seu nome"
          placeholderTextColor={colors.muted}
          style={styles.input}
          testID="settings-name-input"
          returnKeyType="done"
        />

        <Text style={styles.section}>Voz do Orby</Text>
        <Chips items={VOICES} value={p.settings.voice} onPick={(voice) => p.onChange({ voice })} prefix="voice-chip" />
        <Pressable onPress={p.onTestVoice} style={styles.ghostBtn} testID="settings-test-voice-button">
          <Text style={styles.ghostTxt}>Ouvir voz</Text>
        </Pressable>

        <Text style={styles.section}>Paciência com pausas na fala</Text>
        <Text style={styles.hint}>Longa = espera mais antes de achar que você terminou (bom para frases longas).</Text>
        <Chips items={PAUSES} value={p.settings.pause} onPick={(pause) => p.onChange({ pause })} prefix="pause-chip" />

        <Text style={styles.section}>Escuta e visão</Text>
        <Row
          label="Escuta sempre ligada"
          hint={p.continuousOk ? "Modo descanso: só responde quando você diz “Orby”." : "Indisponível neste aparelho, use o microfone."}
          value={p.settings.alwaysListen}
          onChange={(alwaysListen) => p.onChange({ alwaysListen })}
          disabled={!p.continuousOk}
          testID="settings-always-listen-switch"
        />
        <Row
          label="Olhos me seguem"
          hint={p.trackingAvailable ? "Rastreamento instantâneo no aparelho, sem gastar chave." : "Precisa do app instalado (não funciona no Expo Go/web)."}
          value={p.settings.tracking}
          onChange={(tracking) => p.onChange({ tracking })}
          testID="settings-tracking-switch"
        />
        <Row label="Inverter lado do olhar" value={p.settings.mirror} onChange={(mirror) => p.onChange({ mirror })} testID="settings-mirror-switch" />
        <Row label="Mostrar prévia da câmera" value={p.settings.preview} onChange={(preview) => p.onChange({ preview })} testID="settings-preview-switch" />

        <Text style={styles.section}>Memória</Text>
        <View style={styles.btnRow}>
          <Pressable onPress={p.onHistory} style={styles.ghostBtn} testID="settings-history-button">
            <ClockCounterClockwise size={18} color={colors.brand} />
            <Text style={styles.ghostTxt}>Histórico</Text>
          </Pressable>
          <Pressable onPress={p.onClearMemories} style={[styles.ghostBtn, { borderColor: colors.error }]} testID="settings-clear-memories-button">
            <Trash size={18} color={colors.error} />
            <Text style={[styles.ghostTxt, { color: colors.error }]}>Esquecer memórias</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  section: { fontFamily: fonts.displayBold, color: colors.brand, fontSize: 16, marginTop: spacing.lg, marginBottom: spacing.sm, letterSpacing: 0.5 },
  hint: { fontFamily: fonts.text, color: colors.muted, fontSize: 12, lineHeight: 17, marginBottom: spacing.xs },
  label: { fontFamily: fonts.text, color: colors.onSurface, fontSize: 15 },
  input: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceTertiary,
    color: colors.onSurface,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.text,
    fontSize: 15,
  },
  chipRow: { height: 56, flexGrow: 0 },
  chips: { gap: spacing.sm, alignItems: "center", paddingRight: spacing.lg },
  chip: { height: 36, flexShrink: 0, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceTertiary, justifyContent: "center" },
  chipOn: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  chipTxt: { fontFamily: fonts.text, color: colors.onSurfaceTertiary, fontSize: 13 },
  chipTxtOn: { color: colors.brand },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, minHeight: 52 },
  btnRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  ghostBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, alignSelf: "flex-start", height: 44, paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.brand, marginTop: spacing.xs },
  ghostTxt: { fontFamily: fonts.displayBold, color: colors.brand, fontSize: 15 },
});
