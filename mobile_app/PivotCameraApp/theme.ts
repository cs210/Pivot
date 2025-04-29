export const COLORS = {
  background: "#F7F4F1",
  foreground: "#333333",
  card: "#FFFFFF",
  cardForeground: "#333333",
  primary: "#333333",
  primaryForeground: "#FFFFFF",
  secondary: "#A2978A",
  muted: "#EAE7E1",
  border: "#DDDDDD",
};

export const GRADIENTS = {
  cyber: ["#F3E5AB", "#EAAFAF"] as const,
};

export const FONT = {
  regular: "ChakraPetch_400Regular",
  bold: "ChakraPetch_700Bold",
};

export const STYLES = {
  card: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  cyberBorder: {
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
};
