import { type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

export const C = {
  bg: "#f4f5f7",
  panel: "#ffffff",
  ink: "#1d2430",
  muted: "#6b7480",
  line: "#d9dee5",
  accent: "#4c8bf5",
  accentInk: "#1b4fb0",
  ok: "#2f8a4c",
  warn: "#b7791f",
  warnBg: "#fdf6e7",
  bad: "#c23b3b",
  badBg: "#fbecec",
  slab: "#e7e1d6",
};

export function Btn({
  label,
  onPress,
  kind = "default",
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: "default" | "primary" | "danger" | "ghost";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg =
    kind === "primary" ? C.accent : kind === "danger" ? C.badBg : kind === "ghost" ? "transparent" : C.panel;
  const fg = kind === "primary" ? "#fff" : kind === "danger" ? C.bad : C.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        s.btn,
        { backgroundColor: bg, borderColor: kind === "ghost" ? "transparent" : C.line, opacity: disabled ? 0.45 : 1 },
        style,
      ]}
    >
      <Text style={[s.btnText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={s.seg}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[s.segItem, on && { backgroundColor: C.accent }]}
          >
            <Text style={[s.segText, on && { color: "#fff" }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function NumberField({
  label,
  value,
  onCommit,
  placeholder,
}: {
  label: string;
  value: string;
  onCommit: (raw: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        defaultValue={value}
        key={value}
        onEndEditing={(e) => onCommit(e.nativeEvent.text)}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        style={s.input}
      />
    </View>
  );
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        style={s.input}
      />
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={s.sectionTitle}>{children}</Text>;
}

export function Note({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "warn" | "ok" }) {
  const color = tone === "warn" ? C.warn : tone === "ok" ? C.ok : C.muted;
  return (
    <Text style={[s.note, { color }, tone === "warn" && { backgroundColor: C.warnBg, padding: 8, borderRadius: 6 }]}>
      {children}
    </Text>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.row, style]}>{children}</View>;
}

const s = StyleSheet.create({
  btn: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  btnText: { fontSize: 14, fontWeight: "600" },
  seg: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 8,
    overflow: "hidden",
    alignSelf: "flex-start",
  },
  segItem: { paddingVertical: 8, paddingHorizontal: 14, backgroundColor: C.panel },
  segText: { fontSize: 13, color: C.ink, fontWeight: "600" },
  field: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, color: C.muted, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    color: C.ink,
    backgroundColor: C.panel,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 8,
  },
  note: { fontSize: 12, lineHeight: 17, marginVertical: 6 },
  card: {
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
});
