const PROTECTED_ABBREVIATIONS = [
  "dr.",
  "dra.",
  "sr.",
  "sra.",
  "exmo.",
  "exma.",
  "v.s.a.",
  "n.a.",
];

const cleanText = (text: string): string => {
  return text
    .replace(/\s+/g, " ") // Remove multiple whitespaces
    .replace(/\n+/g, " ") // Remove newlines
    .replace(/\t+/g, " ") // Remove tabs
    .trim();
};

const shouldBreakAtChar = (text: string, index: number): boolean => {
  const char = text[index];

  if (char === ";") return true;

  if (char === ".") {
    // Don't break at ellipsis
    if (index > 0 && text[index - 1] === ".") return false;
    if (index < text.length - 1 && text[index + 1] === ".") return false;

    // Don't break at period followed by quotes
    if (index < text.length - 1 && text[index + 1] === '"') return false;

    // Check for protected abbreviations
    const context = text
      .substring(Math.max(0, index - 4), index + 1)
      .toLowerCase();
    if (PROTECTED_ABBREVIATIONS.some((abbr) => context.includes(abbr))) {
      return false;
    }

    return true;
  }

  return false;
};

export function splitText(text: string, maxLength: number): string[] {
  if (!text.trim()) return [];

  const segments: string[] = [];
  let currentText = cleanText(text);
  console.log("Cleaned text length:", currentText.length);

  while (currentText.length > 0) {
    if (currentText.length <= maxLength) {
      segments.push(currentText.trim());
      break;
    }

    let nextStop = -1;
    for (let i = maxLength; i < currentText.length; i++) {
      if (shouldBreakAtChar(currentText, i)) {
        nextStop = i + 1;
        break;
      }
    }

    if (nextStop === -1) {
      segments.push(currentText.trim());
      break;
    }

    const segment = currentText.substring(0, nextStop).trim();
    console.log("Created segment length:", segment.length);
    segments.push(segment);

    currentText = currentText.substring(nextStop).trim();
  }

  return segments.filter((segment) => segment.length > 0);
}
