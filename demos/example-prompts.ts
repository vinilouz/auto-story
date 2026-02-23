function toJsonForPrompt(data: any, includeIndex = false): string {
  if (Array.isArray(data) && includeIndex) {
    return JSON.stringify(data.map((item, index) => ({ index, ...item })), null, 2);
  }
  return JSON.stringify(data, null, 2);
}

export const PROMPTS = {
  /**
   * Visual description generation prompt
   */
  generateVisuals: ({
    segments,
    language,
  }: {
    segments: Array<{ id: string; scriptText: string }>;
    language: string;
  }): string => {
    const segmentsJson = toJsonForPrompt(segments, true);
    return `<Role>
You are a **Script Analyst and Cinematographer**. Your expertise is breaking down a narrative into consistent visual components and then translating them into instructions for an image generator.

</Role>

<Process>
You will follow a rigorous two-step process:
**Step 1: Analysis of Recurring Entities**
1. Read the ENTIRE script provided in <InputScript>.
2. Identify all entities (characters, important objects, creatures) that appear in **two or more scenes**.
3. Create a "Consistency Tag" for each entity, in the format \`<<EntityName>>\`. The name should be short and descriptive (e.g., <<MysteriousWarrior>>, <<CrystalSword>>).
**Step 2: Generating Visual Prompts**
1. For each segment of the script, create a cinematic \`imagePrompt\`.
2. Use the "Consistency Tag" created in Step 1 whenever the corresponding entity is mentioned.
3. Follow the structure and constraints defined below.
</Process>

<Structure>
Each imagePrompt MUST follow this logical order for maximum impact:
[1. Framing/Camera (NO MOTION)] + [2. Lighting/Atmosphere] + [3. Main Subject & Action] + [4. Scenery/Background Details].
Example: "Wide shot in low angle, volumetric sunset lighting, <<MysteriousWarrior>> raising his <<CrystalSword>>, on the edge of a cliff, storm clouds in the background."
</Structure>

<Constraints>
1. **Mandatory Tagging**: It is crucial that ALL recurring entities identified in Step 1 are represented by their tags in the imagePrompts. This is key to visual consistency.
2. **Modesty Protocol**: If the narrative suggests nudity, apply **Strategic Minimalist Concealment**. Do not use the word "nude". Actively describe an element of the scene (shadows, steam, a leaf, long hair) strictly covering private areas.
3. **Descriptive Purity**: Describe the scene as if you were looking through the camera lens. DO NOT use technical rendering terms such as "8k", "hyperrealistic", "Unreal Engine".
</Constraints>

<InputScript>
${segmentsJson}
</InputScript>

<OutputFormat>
Return ONLY the JSON Array in the language ${language}:
[{"id":"...","imagePrompt":"..."}]
</OutputFormat>`;
  },

  /**
   * Entity enhancement prompt
   */
  enhanceEntities: ({
    segments,
    language,
    entities,
  }: {
    segments: string[];
    language: string;
    entities: string[];
  }): string => `<Role>
You are a Lead Concept Artist.
</Role>

<Objective>
Create "Asset Sheets" (definitive visual descriptions) for the listed entities. These descriptions will be used to generate consistent images of the characters/objects.
</Objective>

<SheetLayoutRules>
- **Views:** 3 views (Full body front, back; and a close-up of the face).
- **Background:** Plain white.
- **Annotations:**
- Include a clear height chart next to the front view.
- Add dynamic red arrows with labels identifying key design features.
</SheetLayoutRules>

<Guidance>
For each entity, build the description focusing on **Physicality**:
1. **Subject:** What is it? (Elderly man, Smoky sword, etc.).
2. **Key Features:** Hair, eyes, body structure, marks, muscle definition.
3. **Materials/Textures:** Leather, metal, wrinkled skin, silk fabric, organic sheen.
4. **Clothing/Accessories & Modesty Protocol:**
- Describe the clothing.
- **CRITICAL RULE:** If the context indicates nudity (e.g., "natural state," "bathing," "birth"), apply **Minimalist Concealment**. Do not use the word "nude." Instead, explicitly describe a small contextual element (e.g., "a single leaf," "long strategic hair," "dense shadow," "tiny fabric," "mist") covering *only* the groin (and bust if female), keeping the rest of the anatomy fully exposed and true to the narrative.
5. **Presentation:** "Character sheet style," neutral background, clear visualization.
Avoid artistic style terms (e.g., "pixel art"). Focus on the description of the "real" object.
</Guidance>

<Context>
Story Excerpts:
${segments.join("\n")}
List of Entities:
${toJsonForPrompt(entities)}
</Context>

<OutputFormat>
Return ONLY a JSON Key-Value in the language ${language}:
{"Entity Name": "Detailed physical description, Character sheet style",...}
</OutputFormat>`,

  /**
   * Entity image generation prompt
   */
  generateEntityImage: (
    description: string,
    styleId: string | undefined,
    visualPrompt?: string
  ) => {
    const stylePrompt = visualPrompt ?? styleId ?? "default";
    return `<Role>
ACT AS AN EXPERT CONCEPT ARTIST.
</Role>

<Objective>
Create a high-fidelity visual asset, with this description ${description} and following this art direction ${stylePrompt}.
</Objective>

<Rules>
- Combine subject and style into a single coherent image.
- Ensure details and textures are faithful to the selected style.
- No text overlay. Visuals only.
</Rules>`;
  },

  /**
   * Segment image generation prompt
   */
  generateSegmentImage: (
    description: string,
    styleId: string | undefined,
    isStyleReference: boolean,
    visualPrompt?: string
  ) => {
    const stylePrompt = visualPrompt ?? styleId ?? "default";

    const instruction = isStyleReference
      ? "MIMIC THE ARTISTIC TECHNIQUE of the Style Reference (brushstrokes, line weight, shading method), but apply it to the Subject Description. Do NOT copy the reference image content blindly. Adapt the technique to the new subject."
      : "Create a composition merging the Subject with the Visual Style.";

    return `<role>
ACT AS AN EXPERT ART DIRECTOR
</role>

<objective>
Create a scene with this description ${description} matching the visual style of ${stylePrompt} and using the composiotion logic of ${instruction}.
</objective>

<rules>
- Ensure composition matches the narrative mood.
- Adhere strictly to the defined VISUAL_STYLE_SYSTEM (Materials, Lighting, Textures).
- No text overlay. Render the scene directly.
</rules>`;
  },
};
