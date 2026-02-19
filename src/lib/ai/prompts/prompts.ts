export const SCENE_VISUAL_PROMPT = (segmentsJson: string, language: string, style: string, commentatorName?: string, commentatorPersonality?: string) => {
  const hasCommentator = commentatorName && commentatorPersonality

  const rules = [
    'Establish a dominant focal point using color psychology, describing lighting and camera angle,',
    'Describe abstract elements in visual descriptions,',
    'Describe textures, materials, and details,',
    'Everything must be perfectly plausible with the scene description.',
    !hasCommentator ? `In the ${style} style.` : null,
    hasCommentator ? "The commentator's face must be visible." : null,
    hasCommentator ? `Note that there are scenes narrated by someone telling a story and a commentator named "${commentatorName}" with a personality of "${commentatorPersonality}". Describe what this commentator is doing in that scene. Do not describe the commentator's appearance.` : null,
  ].filter(Boolean)

  return `For this set of scenes:
\`\`\`
${segmentsJson}
\`\`\`

Create the visual description (imagePrompt) for each scene in the format:
\`\`\`
[{"id":"1","imagePrompt":"description 1"},
{"id":"2","imagePrompt":"description 2"},
{"id":"3","imagePrompt":"description 3"}]
\`\`\`

Rules:
${rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
}

export const COMMENTATOR_PROMPT = (commentatorDescription: string, segmentsJson: string) =>
  `Given this commentator profile: "${commentatorDescription}",
generate natural and engaging comments for a story with the following segments.

Story segments:
${segmentsJson}

Guidelines:
- Add comments between segments where contextually appropriate
- Comments must reflect the commentator's personality
- Comments should enhance the story, not just repeat it
- Include an introduction presenting the story without spoilers and a hook to engage the listener
- Include a closing with a conclusion and a hook for commentary
- Keep comments concise (2-4 sentences each)
- Not every segment needs a comment
- Return a JSON array of objects: { type: "scene_text" | "comment", content: string }`

export const COMMENTATOR_IMAGE_GENERATION_PROMPT = (description: string) =>
  `Generate a high-fidelity scene based on the provided reference image.
${description}`
