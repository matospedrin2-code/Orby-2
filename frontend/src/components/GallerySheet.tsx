import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import Svg from "react-native-svg";
import { Sheet } from "@/src/components/Sheet";
import { Brows, Extras, EyeShape, Mouth, VB_H, VB_W } from "@/src/components/FaceParts";
import { FACE_KEYS, getFace } from "@/src/faceCatalog";
import { colors, fonts, radius, spacing } from "@/src/theme";

type Props = { visible: boolean; onClose: () => void; onPick: (key: string) => void };

function MiniFace({ k }: { k: string }) {
  const f = getFace(k);
  return (
    <Svg width={96} height={63} viewBox={`0 0 ${VB_W} ${VB_H}`}>
      <EyeShape kind={f.eyeL} side="L" />
      <EyeShape kind={f.eyeR} side="R" />
      <Brows kind={f.brow} />
      <Mouth kind={f.mouth} />
      <Extras list={f.extras} part="static" />
      <Extras list={f.extras} part="float" />
    </Svg>
  );
}

// All 56 faces: tap one and Orby makes it.
export function GallerySheet({ visible, onClose, onPick }: Props) {
  return (
    <Sheet visible={visible} title="EXPRESSÕES DO ORBY" onClose={onClose} testID="gallery-sheet">
      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {visible &&
          FACE_KEYS.map((k) => (
            <Pressable key={k} style={styles.cell} onPress={() => onPick(k)} testID={`gallery-face-${k}`}>
              <MiniFace k={k} />
              <Text style={styles.label} numberOfLines={1}>{k.replace(/_/g, " ")}</Text>
            </Pressable>
          ))}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingBottom: spacing.lg, justifyContent: "center" },
  cell: { width: 112, alignItems: "center", paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  label: { fontFamily: fonts.text, fontSize: 11, color: colors.hudText, marginTop: 4 },
});

