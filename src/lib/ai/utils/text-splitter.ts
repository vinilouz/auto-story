export const splitTextIntoBatches = (
  text: string,
  maxLength: number = 2000,
  header: string = "",
): string[] => {
  // Normalize line endings
  const normalizedText = text.replace(/\r\n/g, "\n").trim();

  // Header handling
  const effectiveMaxLength = maxLength - (header ? header.length + 2 : 0); // +2 for \n\n
  if (effectiveMaxLength <= 100) {
    console.warn(
      "Header is too long for the maxLength, minimal space left for content.",
    );
  }

  // Split into logical lines (assuming input format has one speaker segment per line/block)
  // We filter out empty lines to avoid noise
  const lines = normalizedText.split("\n").filter((l) => l.trim().length > 0);

  const batches: string[] = [];
  let currentBatch = "";

  const speakerRegex = /^([a-zA-Z0-9\-_]+):\s*(.+)/;
  let currentSpeaker = ""; // Context for current line/block

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Check for speaker change
    const match = trimmedLine.match(speakerRegex);
    if (match) {
      currentSpeaker = match[1];
    }

    // Determine if adding this line would exceed effectiveMaxLength
    // +1 for the newline check if we join with \n or space
    if (currentBatch.length + trimmedLine.length + 1 <= effectiveMaxLength) {
      currentBatch += (currentBatch ? "\n" : "") + trimmedLine;
    } else {
      // Adding this line would overflow.

      if (currentBatch.length > 0) {
        batches.push(header ? `${header}\n\n${currentBatch}` : currentBatch);
        currentBatch = "";
      }

      // Now checks if the line fits in an empty batch
      if (trimmedLine.length <= effectiveMaxLength) {
        currentBatch = trimmedLine;
      } else {
        // The line itself is larger than effectiveMaxLength. We must split it hard (preserving context).
        let remainingLine = trimmedLine;
        // The line likely starts with "speaker: ...".
        // If it continues in chunks, we must prepend "speaker: " to chunks.

        // Re-detect speaker for this specific line (it should match since we are here)
        // But if it was a continuation line (no speaker prefix), use `currentSpeaker`.
        let linePrefix = "";
        if (match) {
          linePrefix = match[1] + ": "; // "narrator: "
        } else if (currentSpeaker) {
          linePrefix = currentSpeaker + ": ";
        }

        // Loop to chop the giant line
        while (remainingLine.length > 0) {
          const prefixToUse =
            remainingLine !== trimmedLine && linePrefix ? linePrefix : "";
          const availableSpace = effectiveMaxLength - prefixToUse.length;

          if (remainingLine.length <= availableSpace) {
            // Fits!
            currentBatch = prefixToUse + remainingLine;
            break; // Done with this line
          }

          // Split needed
          let splitIndex = -1;
          const searchRegion = remainingLine.substring(0, availableSpace);

          // Intelligent split (punctuation)
          const lastPunc = Math.max(
            searchRegion.lastIndexOf("."),
            searchRegion.lastIndexOf("!"),
            searchRegion.lastIndexOf("?"),
          );

          if (lastPunc > availableSpace * 0.5) {
            splitIndex = lastPunc + 1;
          } else {
            const lastSpace = searchRegion.lastIndexOf(" ");
            splitIndex = lastSpace > -1 ? lastSpace : availableSpace;
          }

          const part = remainingLine.substring(0, splitIndex).trim();
          remainingLine = remainingLine.substring(splitIndex).trim();

          const batchContent = prefixToUse + part;
          batches.push(header ? `${header}\n\n${batchContent}` : batchContent);
          // Continues loop with remainingLine
        }
      }
    }
  }

  if (currentBatch) {
    batches.push(header ? `${header}\n\n${currentBatch}` : currentBatch);
  }

  return batches;
};
