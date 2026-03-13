"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import {
  COMMENTATOR_IMAGE_GENERATION_PROMPT,
  GENERATE_ENTITY_IMAGE_PROMPT,
  GENERATE_SEGMENT_IMAGE_PROMPT,
} from "@/lib/ai/prompts/prompts";
import { splitTranscriptionByDuration } from "@/lib/flows/hooks";
import type { StoryFlowState } from "./types";

export function useStoryFlowActions(state: StoryFlowState) {
  const {
    mode,
    stage,
    setStage,
    title,
    scriptText,
    segmentSize,
    language,
    imagePromptStyle,
    audioVoice,
    consistency,
    commentator,
    setCommentator,
    commName,
    commPersonality,
    commImage,
    commImagePrompt,
    audioSystemPrompt,
    segments,
    setSegments,
    entities,
    setEntities,
    imageStatuses,
    setImageStatuses,
    captionStyle,
    videoVolume,
    loading,
    setLoading,
    clipDuration,
    audio,
    transcription,
    videoClips,
    video,
    project,
    dl,
  } = state;

  const save = useCallback(
    async (extra?: any) => {
      const data = {
        name: title || scriptText.substring(0, 30),
        flowType: mode === "commentator" ? "with-commentator" : mode,
        scriptText,
        segmentSize: segmentSize[0],
        language,
        style: imagePromptStyle,
        voice: audioVoice,
        consistency,
        segments,
        entities,
        commentator: commentator || undefined,
        audioBatches: audio.batches,
        audioSystemPrompt,
        transcriptionResults: transcription.results,
        videoVolume,
        ...extra,
      };
      const saved = await project.save(data);
      toast.success("Saved!");
      return saved;
    },
    [
      title,
      scriptText,
      segmentSize,
      language,
      imagePromptStyle,
      audioVoice,
      consistency,
      segments,
      entities,
      commentator,
      audio.batches,
      audioSystemPrompt,
      transcription.results,
      videoVolume,
      mode,
      project,
    ],
  );

  const audioOpts = useCallback(
    () => ({
      text:
        mode === "commentator"
          ? segments
              .filter((s) => s.type)
              .map((s) => `${s.type === "comment" ? "commentator" : "narrator"}: ${s.text}`)
              .join("\n")
          : scriptText,
      voice: audioVoice,
      systemPrompt: audioSystemPrompt,
      projectId: project.projectId || state.projectId,
      projectName: title || "untitled",
    }),
    [mode, segments, scriptText, audioVoice, audioSystemPrompt, project.projectId, state.projectId, title],
  );

  const splitScenes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/generate/split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: scriptText,
          segmentLength: segmentSize[0],
        }),
      });
      if (!res.ok) throw new Error();
      const newSegs = (await res.json()).segments.map((t: string) => ({ text: t }));
      setSegments(newSegs);
      setStage(mode === "commentator" ? "commentator" : "descriptions");
      await save({ segments: newSegs });
    } catch {
      toast.error("Failed to split");
    } finally {
      setLoading(false);
    }
  }, [scriptText, segmentSize, mode, setSegments, setStage, save, setLoading]);

  const saveCommentator = useCallback(async () => {
    const config = {
      id: commentator?.id || Date.now().toString(),
      name: commName,
      personality: commPersonality,
      appearance: {
        type: (commImage?.startsWith("data:") ? "upload" : "generated") as "upload" | "generated",
        imageUrl: commImage || undefined,
        imagePrompt: commImagePrompt || undefined,
      },
    };
    setCommentator(config);
    setStage("comments");
    await save({ commentator: config });
  }, [commentator?.id, commName, commPersonality, commImage, commImagePrompt, setCommentator, setStage, save]);

  const generateComments = useCallback(async () => {
    if (!commentator) return;
    setLoading(true);
    try {
      const res = await fetch("/api/generate/commentator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segments: segments.map((s) => s.text),
          commentatorDescription: `Name: ${commentator.name}. Personality: ${commentator.personality}`,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSegments(data.segments);
      await save({ segments: data.segments });
    } catch {
      toast.error("Failed");
    } finally {
      setLoading(false);
    }
  }, [commentator, segments, setSegments, save, setLoading]);

  const generateDescriptions = useCallback(async () => {
    setLoading(true);
    try {
      const segsForApi =
        mode === "commentator"
          ? segments.map((s) =>
              s.type === "comment"
                ? { ...s, text: `[Commentary by ${commentator?.name}]: ${s.text}` }
                : s,
            )
          : segments;
      const entitiesForApi = entities.map((e) => ({
        type: e.name,
        description: e.description || "",
        segment: e.segment || [],
      }));
      const res = await fetch("/api/generate/descriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segments: segsForApi,
          entities: entitiesForApi,
          language,
          style: imagePromptStyle,
          commentatorName: commentator?.name,
          commentatorPersonality: commentator?.personality,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSegments(data.segments || segments);
      await save({ segments: data.segments });
    } catch {
      toast.error("Failed");
    } finally {
      setLoading(false);
    }
  }, [mode, segments, entities, language, imagePromptStyle, commentator, setSegments, save, setLoading]);

  const extractAndGenerateEntities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/generate/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segments }),
      });
      if (!res.ok) throw new Error();
      const { entities: extracted } = await res.json();
      const ents = extracted.map((e: any) => ({
        name: e.type,
        description: e.description,
        segment: e.segment,
        status: "pending" as const,
      }));
      setEntities(ents);
      await save({ entities: ents });

      if (ents.length > 0 && ents.some((e: any) => e.description)) {
        await generateEntitiesInternal(ents, true);
      }
    } catch {
      toast.error("Failed to extract entities");
    } finally {
      setLoading(false);
    }
  }, [segments, setEntities, save, setLoading]);

  const generateEntitiesInternal = useCallback(
    async (entitiesList?: typeof entities, skipLoading = false) => {
      if (!skipLoading) setLoading(true);
      try {
        let pid = project.projectId;
        if (!pid) {
          const s = await save();
          pid = s?.id;
        }

        const source = entitiesList ?? entities;
        const missing = source.filter((e) => !e.imageUrl);
        const targets = missing.length > 0 ? missing : source;

        if (targets.length === 0) {
          if (!skipLoading) setLoading(false);
          return;
        }

        const processing = source.map((e) => {
          if (!targets.some((t) => t.name === e.name)) return e;
          return { ...e, status: "generating" as const };
        });
        setEntities(processing);

        const requests = processing
          .map((e) =>
            targets.some((t) => t.name === e.name) && e.description
              ? {
                  imagePrompt: GENERATE_ENTITY_IMAGE_PROMPT(e.description, undefined, imagePromptStyle),
                  imageConfig: { aspect_ratio: "16:9" },
                  entityName: e.name,
                }
              : null,
          )
          .filter(Boolean);

        if (requests.length === 0) {
          setEntities(processing);
          return;
        }

        const r = await fetch("/api/generate/images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requests, projectId: pid, projectName: title }),
        });
        if (!r.ok) throw new Error();

        const reader = r.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let latestEnts = [...processing];
        const targetNames = targets.map((t) => t.name);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const event = JSON.parse(line.slice(6));
            if (event.done) break;

            let targetIdx = -1;
            let count = 0;
            for (let j = 0; j < latestEnts.length; j++) {
              if (targetNames.includes(latestEnts[j].name) && latestEnts[j].description) {
                if (count === event.id) {
                  targetIdx = j;
                  break;
                }
                count++;
              }
            }
            if (targetIdx === -1) continue;

            if (event.status === "success" && event.data?.imageUrl) {
              latestEnts = latestEnts.map((e, j) =>
                j === targetIdx ? { ...e, imageUrl: event.data.imageUrl, status: "completed" as const } : e,
              );
            } else {
              latestEnts = latestEnts.map((e, j) =>
                j === targetIdx ? { ...e, status: "error" as const } : e,
              );
            }
            setEntities([...latestEnts]);
          }
        }

        setEntities(latestEnts);
        await save({ entities: latestEnts });
      } catch {
        toast.error("Failed");
      } finally {
        if (!skipLoading) setLoading(false);
      }
    },
    [entities, imagePromptStyle, project.projectId, title, setEntities, save, setLoading],
  );

  const generateSingleEntity = useCallback(
    async (entityIndex: number) => {
      const e = entities[entityIndex];
      if (!e || !e.description) return;

      let pid = project.projectId;
      if (!pid) {
        const s = await save();
        pid = s?.id;
      }

      setEntities((prev) => prev.map((ent, i) => (i === entityIndex ? { ...ent, status: "generating" } : ent)));

      try {
        const payload: any = {
          imagePrompt: GENERATE_ENTITY_IMAGE_PROMPT(e.description, undefined, imagePromptStyle),
          imageConfig: { aspect_ratio: "16:9" },
          projectId: pid,
          projectName: title,
          entityName: e.name,
        };

        const res = await fetch("/api/generate/images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error();
        const data = await res.json();

        let updatedEnts: typeof entities = [];
        setEntities((prev) => {
          updatedEnts = prev.map((ent, i) =>
            i === entityIndex ? { ...ent, imageUrl: data.imageUrl, status: "completed" } : ent,
          );
          return updatedEnts;
        });
        await save({ entities: updatedEnts });
        toast.success(`Generated image for ${e.name}`);
      } catch {
        setEntities((prev) =>
          prev.map((ent, i) => (i === entityIndex ? { ...ent, status: "error" } : ent)),
        );
        toast.error(`Failed to generate ${e.name}`);
      }
    },
    [entities, imagePromptStyle, project.projectId, title, setEntities, save],
  );

  const generateSingleImage = useCallback(
    async (segIndex: number) => {
      const seg = segments[segIndex];
      if (!seg?.imagePrompt) return;
      setImageStatuses((p) => new Map(p).set(segIndex, "generating"));
      try {
        const prompt =
          mode === "commentator" && commentator?.appearance?.imageUrl
            ? COMMENTATOR_IMAGE_GENERATION_PROMPT(seg.imagePrompt)
            : GENERATE_SEGMENT_IMAGE_PROMPT(seg.imagePrompt, imagePromptStyle);
        const payload: any = {
          imagePrompt: prompt,
          imageConfig: { aspect_ratio: "16:9" },
          systemPrompt: imagePromptStyle,
          projectId: project.projectId || state.projectId,
          projectName: title,
          index: segIndex,
        };
        const matches = prompt.match(/<<([^>]+)>>/g);
        let refs: string[] = [];
        if (entities.length > 0) {
          refs = entities
            .filter((e) => {
              const hasImage = !!e.imageUrl;
              const isMatch = matches?.some((m) => m.includes(e.name));
              const inSegment = e.segment?.includes(segIndex + 1);
              return hasImage && (isMatch || inSegment);
            })
            .map((e) => e.imageUrl!);
        }

        if (refs.length > 0) {
          payload.referenceImages = refs;
        } else if (mode === "commentator" && commentator?.appearance?.imageUrl) {
          payload.referenceImage = commentator.appearance.imageUrl;
        }
        const res = await fetch("/api/generate/images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        let updatedSegs: typeof segments = [];
        setSegments((prev) => {
          updatedSegs = prev.map((s, j) => (j === segIndex ? { ...s, imagePath: data.imageUrl } : s));
          return updatedSegs;
        });
        setImageStatuses((p) => {
          const n = new Map(p);
          n.delete(segIndex);
          return n;
        });
        await save({ segments: updatedSegs });
      } catch {
        setImageStatuses((p) => new Map(p).set(segIndex, "error"));
      }
    },
    [
      segments,
      mode,
      commentator,
      imagePromptStyle,
      entities,
      project.projectId,
      state.projectId,
      title,
      setSegments,
      setImageStatuses,
      save,
    ],
  );

  const generateAllImages = useCallback(async () => {
    let pid = project.projectId;
    if (!pid) {
      const s = await save();
      pid = s?.id;
    }

    if (consistency && entities.length > 0 && entities.some((e) => !e.imageUrl)) {
      await generateEntitiesInternal();
    }

    const isRegen = segments.every((s) => s.imagePath);
    let currentSegments = segments;

    if (isRegen) {
      currentSegments = segments.map((s) => ({ ...s, imagePath: undefined }));
      setSegments(currentSegments);
      await save({ segments: currentSegments });
    }

    const indices = currentSegments
      .map((seg, i) => (!seg.imagePrompt || (!isRegen && seg.imagePath) ? -1 : i))
      .filter((i) => i >= 0);

    if (indices.length === 0) return;

    const statusMap = new Map<number, "error" | "generating">(indices.map((i) => [i, "generating"]));
    setImageStatuses(statusMap);

    const requests = indices.map((segIndex) => {
      const seg = currentSegments[segIndex];
      const prompt =
        mode === "commentator" && commentator?.appearance?.imageUrl
          ? COMMENTATOR_IMAGE_GENERATION_PROMPT(seg.imagePrompt!)
          : GENERATE_SEGMENT_IMAGE_PROMPT(seg.imagePrompt!, imagePromptStyle);
      const payload: any = {
        imagePrompt: prompt,
        imageConfig: { aspect_ratio: "16:9" },
        systemPrompt: imagePromptStyle,
        index: segIndex,
      };
      const matches = prompt.match(/<<([^>]+)>>/g);
      let refs: string[] = [];
      if (entities.length > 0) {
        refs = entities
          .filter((e) => {
            const hasImage = !!e.imageUrl;
            const isMatch = matches?.some((m) => m.includes(e.name));
            const inSegment = e.segment?.includes(segIndex + 1);
            return hasImage && (isMatch || inSegment);
          })
          .map((e) => e.imageUrl!);
      }

      if (refs.length > 0) {
        payload.referenceImages = refs;
      } else if (mode === "commentator" && commentator?.appearance?.imageUrl) {
        payload.referenceImage = commentator.appearance.imageUrl;
      }
      return payload;
    });

    try {
      const r = await fetch("/api/generate/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requests, projectId: pid, projectName: title }),
      });
      if (!r.ok) throw new Error();

      const reader = r.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let latestSegs = [...segments];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const event = JSON.parse(line.slice(6));
          if (event.done) break;

          const segIndex = indices[event.id];
          if (event.status === "success" && event.data?.imageUrl) {
            latestSegs = latestSegs.map((s, j) =>
              j === segIndex ? { ...s, imagePath: event.data.imageUrl } : s,
            );
            setSegments([...latestSegs]);
            setImageStatuses((p) => {
              const n = new Map(p);
              n.delete(segIndex);
              return n;
            });
          } else {
            setImageStatuses((p) => new Map(p).set(segIndex, "error"));
          }
        }
      }

      setSegments(latestSegs);
      await save({ segments: latestSegs });
    } catch {
      const errorMap = new Map<number, "error" | "generating">(indices.map((i) => [i, "error"]));
      setImageStatuses(errorMap);
    }
  }, [
    segments,
    entities,
    consistency,
    mode,
    commentator,
    imagePromptStyle,
    project.projectId,
    title,
    generateEntitiesInternal,
    setSegments,
    setImageStatuses,
    save,
  ]);

  const generateAudioAction = useCallback(async () => {
    const newBatches = await audio.generate(audioOpts());
    setStage("audio");
    await save({ audioBatches: newBatches });
  }, [audio, audioOpts, setStage, save]);

  const transcribeAction = useCallback(async () => {
    const newResults = await transcription.transcribe(audio.batches, language);
    setStage("transcription");
    if (newResults) await save({ transcriptionResults: newResults });
  }, [transcription, audio.batches, language, setStage, save]);

  const splitByDuration = useCallback(async () => {
    const newSegs = splitTranscriptionByDuration(transcription.results, audio.batches, clipDuration);
    if (newSegs.length === 0) {
      toast.error("No words found in transcription");
      return;
    }
    setSegments(newSegs);
    setStage("split");
    await save({ segments: newSegs });
  }, [transcription.results, audio.batches, clipDuration, setSegments, setStage, save]);

  const generateAllClips = useCallback(async () => {
    let pid = project.projectId;
    if (!pid) {
      const s = await save();
      pid = s?.id;
    }
    await videoClips.generateAll(segments, setSegments, {
      projectId: pid || state.projectId,
      projectName: title,
      clipDuration,
      onClipCompleted: async (newSegments) => {
        await save({ segments: newSegments });
      },
    });
  }, [segments, project.projectId, state.projectId, title, clipDuration, videoClips, setSegments, save]);

  const generateVideoPreview = useCallback(async () => {
    try {
      const segs = segments
        .filter((s) => s.imagePrompt)
        .map((s, i) => ({
          id: `seg-${i}`,
          text: s.text,
          imageUrl: s.imagePath || "",
          videoClipUrl: s.videoClipUrl || undefined,
        }));
      const alignmentMode = mode === "video-story" ? ("video" as const) : ("image" as const);
      await video.generate(segs, audio.batches, transcription.results, alignmentMode, videoVolume);
      setStage("video");
    } catch (e: any) {
      toast.error(`Video generation failed: ${e.message}`);
    }
  }, [segments, mode, audio.batches, transcription.results, video, videoVolume, setStage]);

  const renderVideoAction = useCallback(async () => {
    if (!video.videoProps) return;
    try {
      await video.render({ ...video.videoProps, videoVolume }, captionStyle, project.projectId || undefined, title);
    } catch (e: any) {
      toast.error(`Render failed: ${e.message}`);
    }
  }, [video, captionStyle, videoVolume, project.projectId, title]);

  const downloadZipAction = useCallback(async () => {
    try {
      await dl.downloadZip({
        segments,
        audioUrls: audio.batches.filter((b) => b.status === "completed" && b.url).map((b) => b.url!),
        transcriptionResults: transcription.results,
        filename: `${mode}-story-${Date.now()}.zip`,
      });
    } catch {
      toast.error("Download failed");
    }
  }, [segments, audio.batches, transcription.results, mode, dl]);

  return {
    save,
    audioOpts,
    splitScenes,
    saveCommentator,
    generateComments,
    generateDescriptions,
    extractAndGenerateEntities,
    generateEntities: generateEntitiesInternal,
    generateSingleEntity,
    generateSingleImage,
    generateAllImages,
    generateAudioAction,
    transcribeAction,
    splitByDuration,
    generateAllClips,
    generateVideoPreview,
    renderVideoAction,
    downloadZipAction,
  };
}

export type StoryFlowActions = ReturnType<typeof useStoryFlowActions>;
