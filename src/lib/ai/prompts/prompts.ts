const toJsonForPrompt = (data: any, minify = false) =>
  JSON.stringify(data, null, minify ? 0 : 2);

export const EXTRACT_ENTITIES_PROMPT = (
  segments: Array<{ id: number; text: string }>,
) => `<Role>
You are a Script Analyst and Concept Artist specialized in identifying recurring entities (e.g., characters, scenarios, objects) between scenes.
</Role>

<Objective>
Read the story divided in scenes. For each entity (character, creature, important object) that appears in MORE THAN ONE scene:
1. Create a unique name (ex: HeroWarrior, CrystalSword)
2. Create a complete visual description following the rules below
3. List in which scenes it appears
</Objective>

<DescriptionRules>
Focus on PHYSICALITY:
1. **Subject:** What is it? (Elderly man, Smoky sword, etc.)
2. **Key Features:** Hair, eyes, body structure, marks, muscle definition.
3. **Materials/Textures:** Leather, metal, wrinkled skin, silk fabric, organic sheen.
4. **Clothing/Accessories & Modesty Protocol:**
   - Describe clothing.
   - **CRITICAL RULE:** If context indicates nudity or gore, apply **Minimalist Concealment**. Do not use the word "nude". Instead, explicitly describe a small contextual element (ex: "a single leaf", "long strategic hair", shadows, steam) covering *only* the groin (and bust if female).
5. **Presentation:** High-fidelity character sheet. 3 views: full-body front, full-body back, big face face close-up. Bg: (Neutral light gray studio background, #CCCCCC:1.2). Height next to front view.
No artistic style terms. Focus on the "real" object. If not a character, explicitly state NO characters in image.
</DescriptionRules>

<InputScript>
${toJsonForPrompt(segments, true)}
</InputScript>

<OutputFormat>
Return ONLY a JSON array in this exact format:
[
  {
    "type": "HeroWarrior",
    "segment": [1, 2, 3],
    "description": "Tall man with silver armor, long brown hair, blue eyes..."
  }
]
</OutputFormat>`;

export const BATCH_DESCRIPTIONS_PROMPT = (
  segments: Array<{ id: string; scriptText: string }>,
  entities: Array<{ type: string; description: string }>,
  language: string,
) => {
  const entitiesContext =
    entities.length > 0
      ? `<EntitiesContext>
Use these consistency tags when the entity appears in a scene. The tag format is <<EntityName>>.
${entities.map((e) => `<<${e.type}>>: ${e.description}`).join("\n")}
</EntitiesContext>`
      : "";

  return `<Role>
You are a Script Analyst and Cinematographer specialized in translating narrative into image generation instructions.
</Role>

${entitiesContext}

<Structure>
Each imagePrompt MUST follow this logical order:
[1. Framing/Camera (NO MOTION)] + [2. Lighting/Atmosphere] + [3. Main Subject & Action] + [4. Scenery/Background Details].
Example: "Wide shot in low angle, volumetric sunset lighting, <<MysteriousWarrior>> raising his <<CrystalSword>>, on the edge of a cliff, storm clouds in the background."
</Structure>

<Constraints>
1. **Mandatory Tagging**: Use the entity tags (<<EntityName>>) whenever a known entity appears in the scene.
2. **Modesty Protocol**: If the narrative suggests nudity, apply **Strategic Minimalist Concealment**. Do not use the word "nude". Actively describe an element of the scene (shadows, steam, a leaf, long hair) strictly covering private areas.
3. **Descriptive Purity**: Describe the scene as if looking through a camera lens. DO NOT use technical rendering terms such as "8k", "hyperrealistic", "Unreal Engine".
4. **Audio Neutrality**: NEVER use words like "speaking", "talking", "whispering", "singing", "sound", "voice" or any audio-related terms. Describe actions visually only (e.g., instead of "speaking" use "with mouth open" or omit entirely).
</Constraints>

<InputScript>
${toJsonForPrompt(segments, true)}
</InputScript>

<OutputFormat>
You MUST return ONLY a VALID JSON array of objects in the language ${language}.
Do NOT use markdown blocks. Do NOT add any text before or after the JSON.
Every segment ID in the InputScript MUST have a corresponding object in your response.
Every object MUST have exactly two keys: "id" (string) and "imagePrompt" (string).
Example for 2 segments:
[
  { "id": "1", "imagePrompt": "Description for segment 1..." },
  { "id": "2", "imagePrompt": "Description for segment 2..." }
]
</OutputFormat>`;
};

export const GENERATE_ENTITY_IMAGE_PROMPT = (
  description: string,
  styleId: string | undefined,
  visualPrompt?: string,
) => {
  const stylePrompt = visualPrompt ?? styleId ?? "default";
  return `Style: ${stylePrompt}
Description: ${description}`;
  //   `<Role>
  // ACT AS AN EXPERT CONCEPT ARTIST.
  // </Role>

  // <Objective>
  // Create a high-fidelity visual asset, with this description ${description} and following this art direction ${stylePrompt}.
  // </Objective>

  // <Rules>
  // - Combine subject and style into a single coherent image.
  // - Ensure details and textures are faithful to the art direction.
  // - No text overlay. Visuals only.
  // </Rules>`
};

export const GENERATE_SEGMENT_IMAGE_PROMPT = (
  description: string,
  visualPrompt?: string,
) => {
  const stylePrompt = visualPrompt ?? "default";

  return `<role>
ACT AS AN EXPERT ART DIRECTOR
</role>

<objective>
Create a scene with this description ${description} matching the visual style of ${stylePrompt}.
</objective>

<rules>
- Ensure composition matches the narrative mood.
- Adhere strictly to the defined VISUAL_STYLE_SYSTEM (Materials, Lighting, Textures).
- No text overlay. Render the scene directly.
</rules>`;
};

export const COMMENTATOR_PROMPT = (
  commentatorDescription: string,
  segmentsJson: string,
) =>
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
            - Keep comments concise(2 - 4 sentences each)
    - Not every segment needs a comment
      - Return a JSON array of objects: { type: "scene_text" | "comment", content: string } `;

export const COMMENTATOR_IMAGE_GENERATION_PROMPT = (description: string) =>
  `Generate a high - fidelity scene based on the provided reference image.
    ${description} `;

const VIDEO_SILENCE_PROMPT = "No voice, No Speaking, no music, only sfx";

export const GENERATE_VIDEO_PROMPT = (
  style: string,
  sceneDescription: string,
) => `${style} \n ${sceneDescription} \n ${VIDEO_SILENCE_PROMPT}`;
