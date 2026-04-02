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
    music,
    musicPrompt,
    setMusicPrompt,
    musicUrl,
    setMusicUrl,
    musicVolume,
    musicCompressor,
    musicRaw,
    uploadedAudioFile,
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
        transcriptionResult: transcription.result,
        videoVolume,
        musicEnabled: music,
        music: musicUrl,
        musicVolume,
        musicRaw,
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
      transcription.result,
      videoVolume,
      music,
      musicUrl,
      musicVolume,
      musicRaw,
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
              .map(
                (s) =>
                  `${s.type === "comment" ? "commentator" : "narrator"}: ${s.text}`,
              )
              .join("\n")
          : scriptText,
      voice: audioVoice,
      systemPrompt: audioSystemPrompt,
      projectId: project.projectId || state.projectId,
    }),
    [
      mode,
      segments,
      scriptText,
      audioVoice,
      audioSystemPrompt,
      project.projectId,
      state.projectId,
    ],
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
      const newSegs = (await res.json()).segments.map((t: string) => ({
        text: t,
      }));
      setSegments(newSegs);
      setStage(mode === "commentator" ? "commentator" : "descriptions");
      await save({ segments: newSegs });
    } catch {
      toast.error("Failed to split");
    } finally {
      setLoading(false);
    }
  }, [scriptText, segmentSize, mode, setSegments, setStage, save, setLoading]);

  // ── from-audio: upload audio file then transcribe ────────────────────────
  const uploadAudioAndTranscribe = useCallback(async () => {
    if (!uploadedAudioFile) {
      toast.error("No audio file selected");
      return;
    }
    setLoading(true);
    try {
      // 1. Save project metadata so the directory is created
      const saved = await save({ flowType: "from-audio", scriptText: " " });
      const pid = saved?.id ?? state.projectId;

      // 2. Upload the audio file to the server
      const form = new FormData();
      form.append("file", uploadedAudioFile);
      form.append("projectId", pid);

      const uploadRes = await fetch("/api/upload/audio", {
        method: "POST",
        body: form,
      });
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Audio upload failed");
      }

      // 3. Transcribe the uploaded audio
      const tResults = await transcription.transcribe(pid);
      if (tResults) await save({ transcriptionResult: tResults });

      toast.success("Audio uploaded & transcribed!");
      setStage("transcription");
    } catch (e: any) {
      toast.error(e.message ?? "Upload or transcription failed");
    } finally {
      setLoading(false);
    }
  }, [
    uploadedAudioFile,
    state.projectId,
    save,
    transcription,
    setStage,
    setLoading,
  ]);

  const saveCommentator = useCallback(async () => {
    const config = {
      id: commentator?.id || Date.now().toString(),
      name: commName,
      personality: commPersonality,
      appearance: {
        type: (commImage?.startsWith("data:") ? "upload" : "generated") as
          | "upload"
          | "generated",
        imageUrl: commImage || undefined,
        imagePrompt: commImagePrompt || undefined,
      },
    };
    setCommentator(config);
    setStage("comments");
    await save({ commentator: config });
  }, [
    commentator?.id,
    commName,
    commPersonality,
    commImage,
    commImagePrompt,
    setCommentator,
    setStage,
    save,
  ]);

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
      const newSegs = data.segments.map((s: any) => ({
        text: s.text,
        type: s.type as "scene_text" | "comment",
      }));
      setSegments(newSegs);
      setStage(consistency ? "entities" : "descriptions");
      await save({ segments: newSegs });
    } catch {
      toast.error("Failed to generate comments");
    } finally {
      setLoading(false);
    }
  }, [
    commentator,
    segments,
    consistency,
    setSegments,
    setStage,
    save,
    setLoading,
  ]);

  const generateDescriptions = useCallback(async () => {
    setLoading(true);
    try {
      const segsForApi =
        mode === "commentator"
          ? segments.map((s) =>
              s.type === "comment"
                ? {
                    ...s,
                    text: `[Commentary by ${commentator?.name}]: ${s.text}`,
                  }
                : s,
            )
          : segments;

      const res = await fetch("/api/generate/descriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segments: segsForApi,
          entities: entities.map((e) => ({
            type: e.name,
            description: e.description || "",
            segment: e.segment || [],
          })),
          language,
          style: imagePromptStyle,
          commentatorName: commentator?.name,
          commentatorPersonality: commentator?.personality,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const updatedSegs = segments.map((s, i) => ({
        ...s,
        imagePrompt: data.segments[i]?.imagePrompt || s.imagePrompt,
      }));
      setSegments(updatedSegs);
      setStage("images");
      await save({ segments: updatedSegs });
    } catch {
      toast.error("Failed to generate descriptions");
    } finally {
      setLoading(false);
    }
  }, [
    segments,
    mode,
    commentator,
    entities,
    language,
    imagePromptStyle,
    setSegments,
    setStage,
    save,
    setLoading,
  ]);

  const generateMissingDescriptions = useCallback(async () => {
    const missingIndices = segments
      .map((s, i) => (!s.imagePrompt ? i : -1))
      .filter((i) => i >= 0);

    if (missingIndices.length === 0) return;

    setLoading(true);
    try {
      const missingSegments = missingIndices.map((i) => segments[i]);
      const segsForApi =
        mode === "commentator"
          ? missingSegments.map((s) =>
              s.type === "comment"
                ? {
                    ...s,
                    text: `[Commentary by ${commentator?.name}]: ${s.text}`,
                  }
                : s,
            )
          : missingSegments;

      const res = await fetch("/api/generate/descriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segments: segsForApi,
          entities: entities.map((e) => ({
            type: e.name,
            description: e.description || "",
            segment: e.segment || [],
          })),
          language,
          style: imagePromptStyle,
          commentatorName: commentator?.name,
          commentatorPersonality: commentator?.personality,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();

      let newIdx = 0;
      const updatedSegs = segments.map((s) => {
        if (!s.imagePrompt && newIdx < data.segments.length) {
          return { ...s, imagePrompt: data.segments[newIdx++].imagePrompt };
        }
        return s;
      });

      setSegments(updatedSegs);
      await save({ segments: updatedSegs });
    } catch {
      toast.error("Failed to generate descriptions");
    } finally {
      setLoading(false);
    }
  }, [
    segments,
    mode,
    commentator,
    entities,
    language,
    imagePromptStyle,
    setSegments,
    save,
    setLoading,
  ]);

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
                  imagePrompt: GENERATE_ENTITY_IMAGE_PROMPT(
                    e.description,
                    undefined,
                    imagePromptStyle,
                  ),
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
          body: JSON.stringify({ requests, projectId: pid }),
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
              if (
                targetNames.includes(latestEnts[j].name) &&
                latestEnts[j].description
              ) {
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
                j === targetIdx
                  ? {
                      ...e,
                      imageUrl: event.data.imageUrl,
                      status: "completed" as const,
                    }
                  : e,
              );
              setEntities([...latestEnts]);
              await save({ entities: latestEnts });
            } else {
              latestEnts = latestEnts.map((e, j) =>
                j === targetIdx ? { ...e, status: "error" as const } : e,
              );
              setEntities([...latestEnts]);
            }
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
    [
      entities,
      imagePromptStyle,
      project.projectId,
      title,
      setEntities,
      save,
      setLoading,
    ],
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

      setEntities((prev) =>
        prev.map((ent, i) =>
          i === entityIndex ? { ...ent, status: "generating" } : ent,
        ),
      );

      try {
        const payload: any = {
          imagePrompt: GENERATE_ENTITY_IMAGE_PROMPT(
            e.description,
            undefined,
            imagePromptStyle,
          ),
          imageConfig: { aspect_ratio: "16:9" },
          projectId: pid,
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
            i === entityIndex
              ? { ...ent, imageUrl: data.imageUrl, status: "completed" }
              : ent,
          );
          return updatedEnts;
        });
        await save({ entities: updatedEnts });
        toast.success(`Generated image for ${e.name}`);
      } catch {
        setEntities((prev) =>
          prev.map((ent, i) =>
            i === entityIndex ? { ...ent, status: "error" } : ent,
          ),
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
        } else if (
          mode === "commentator" &&
          commentator?.appearance?.imageUrl
        ) {
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
          updatedSegs = prev.map((s, j) =>
            j === segIndex ? { ...s, imagePath: data.imageUrl } : s,
          );
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

    if (
      consistency &&
      entities.length > 0 &&
      entities.some((e) => !e.imageUrl)
    ) {
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
      .map((seg, i) =>
        !seg.imagePrompt || (!isRegen && seg.imagePath) ? -1 : i,
      )
      .filter((i) => i >= 0);

    if (indices.length === 0) return;

    const statusMap = new Map<number, "error" | "generating">(
      indices.map((i) => [i, "generating"]),
    );
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
        body: JSON.stringify({ requests, projectId: pid }),
      });
      if (!r.ok) throw new Error();

      const reader = r.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let latestSegs = [...currentSegments];

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
          if (segIndex === undefined) continue;

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
            await save({ segments: latestSegs });
          } else {
            setImageStatuses((p) => new Map(p).set(segIndex, "error"));
          }
        }
      }

      setSegments(latestSegs);
      await save({ segments: latestSegs });
    } catch {
      const errorMap = new Map<number, "error" | "generating">(
        indices.map((i) => [i, "error"]),
      );
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
    const newResults = await transcription.transcribe(
      project.projectId || state.projectId,
    );
    setStage("transcription");
    if (newResults) await save({ transcriptionResults: newResults });
  }, [transcription, project.projectId, state.projectId, setStage, save]);

  const splitByDuration = useCallback(async () => {
    const completedBatches = audio.batches.filter(
      (b) => b.status === "completed" && b.url,
    );
    if (completedBatches.length === 0) {
      toast.error("No completed audio batches");
      return;
    }
    const audioDurationsMs = await Promise.all(
      completedBatches.map((b) =>
        Promise.race([
          new Promise<number>((resolve, reject) => {
            const el = new Audio(b.url!);
            el.onloadedmetadata = () => resolve(el.duration * 1000);
            el.onerror = () => reject(new Error(`Audio load error: ${b.url}`));
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Audio load timeout")), 10000),
          ),
        ]),
      ),
    );
    const newSegs = await splitTranscriptionByDuration(
      transcription.result ? [transcription.result] : [],
      audio.batches,
      clipDuration,
      audioDurationsMs,
    );
    if (newSegs.length === 0) {
      toast.error("No words found in transcription");
      return;
    }
    setSegments(newSegs);
    setStage("split");
    await save({ segments: newSegs });
  }, [
    transcription.result,
    audio.batches,
    clipDuration,
    setSegments,
    setStage,
    save,
  ]);

  const generateAllClips = useCallback(async () => {
    let pid = project.projectId;
    if (!pid) {
      const s = await save();
      pid = s?.id;
    }
    await videoClips.generateAll(segments, setSegments, {
      projectId: pid || state.projectId,
      clipDuration,
      onClipCompleted: async (newSegments) => {
        await save({ segments: newSegments });
      },
    });
  }, [
    segments,
    project.projectId,
    state.projectId,
    title,
    clipDuration,
    videoClips,
    setSegments,
    save,
  ]);

  const generateVideoPreview = useCallback(async () => {
    try {
      const missingPromptIdx = segments.findIndex((s) => !s.imagePrompt);
      if (missingPromptIdx !== -1) {
        throw new Error(`Segment ${missingPromptIdx + 1} has no image prompt`);
      }
      const segs = segments.map((s, i) => ({
        id: `seg-${i}`,
        text: s.text,
        imageUrl: s.imagePath || "",
        videoClipUrl: s.videoClipUrl || undefined,
      }));
      const alignmentMode =
        mode === "video-story" ? ("video" as const) : ("image" as const);
      const effectiveMusicUrl = musicUrl && musicRaw
        ? musicUrl.replace("background.mp4", "background-raw.mp4")
        : musicUrl ?? undefined;
      await video.generate(
        segs,
        audio.batches,
        transcription.result,
        alignmentMode,
        videoVolume,
        effectiveMusicUrl,
        musicVolume,
      );
      setStage("video");
    } catch (e: any) {
      toast.error(`Video generation failed: ${e.message}`);
    }
  }, [
    segments,
    mode,
    audio.batches,
    transcription.result,
    video,
    videoVolume,
    musicUrl,
    musicVolume,
    musicRaw,
    setStage,
  ]);

  const renderVideoAction = useCallback(async () => {
    if (!video.videoProps) return;
    try {
      await video.render(
        { ...video.videoProps, videoVolume, musicVolume, musicCompressor },
        captionStyle,
        project.projectId || undefined,
      );
    } catch (e: any) {
      toast.error(`Render failed: ${e.message}`);
    }
  }, [video, captionStyle, videoVolume, musicVolume, musicCompressor, project.projectId]);

  const downloadZipAction = useCallback(async () => {
    try {
      await dl.downloadZip({
        segments,
        audioUrls: audio.batches
          .filter((b) => b.status === "completed" && b.url)
          .map((b) => b.url!),
        transcriptionResult: transcription.result,
        filename: `${mode}-story-${Date.now()}.zip`,
      });
    } catch {
      toast.error("Download failed");
    }
  }, [segments, audio.batches, transcription.result, mode, dl]);

  const updateSegmentImagePrompt = useCallback(
    (index: number, imagePrompt: string) => {
      setSegments((prev) =>
        prev.map((s, i) => (i === index ? { ...s, imagePrompt } : s)),
      );
    },
    [setSegments],
  );

  const generateMusicPrompt = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/generate/music-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segments: segments.map((s) => ({ text: s.text })),
          language,
        }),
      });

      if (!res.ok) throw new Error();
      const data = await res.json();
      setMusicPrompt(data.musicPrompt);
      await save({ musicPrompt: data.musicPrompt } as any);
      toast.success("Music prompt generated!");
    } catch {
      toast.error("Failed to generate music prompt");
    } finally {
      setLoading(false);
    }
  }, [segments, language, setMusicPrompt, setStage, save, setLoading]);

  const generateMusic = useCallback(async () => {
    setLoading(true);
    try {
      let pid = project.projectId;
      if (!pid) {
        const s = await save();
        pid = s?.id;
      }

      const res = await fetch("/api/generate/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: pid || state.projectId,
          prompt: musicPrompt || undefined,
        }),
      });

      if (!res.ok) throw new Error();

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let event: any;
          try {
            event = JSON.parse(line.slice(6));
          } catch {
            continue;
          }

          if (event.type === "error") {
            throw new Error(event.error || "Music generation failed");
          }

          if (event.type === "done" && event.musicUrl) {
            setMusicUrl(event.musicUrl);
            await save({ music: event.musicUrl });
            toast.success("Music generated!");
          }
        }
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to generate music");
    } finally {
      setLoading(false);
    }
  }, [
    project.projectId,
    state.projectId,
    musicPrompt,
    setMusicUrl,
    save,
    setLoading,
  ]);

  const generateCommentatorImage = useCallback(async () => {
    if (!commImagePrompt.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/generate/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imagePrompt: commImagePrompt,
          projectId: project.projectId || state.projectId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.imageUrl) {
          state.setCommImage(data.imageUrl);
        }
      }
    } catch {
      toast.error("Failed to generate image");
    } finally {
      setLoading(false);
    }
  }, [
    commImagePrompt,
    project.projectId,
    state.projectId,
    title,
    state,
    setLoading,
  ]);

  return {
    save,
    audioOpts,
    splitScenes,
    uploadAudioAndTranscribe,
    saveCommentator,
    generateComments,
    generateDescriptions,
    generateMissingDescriptions,
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
    updateSegmentImagePrompt,
    generateMusicPrompt,
    generateMusic,
    generateCommentatorImage,
  };
}

export type StoryFlowActions = ReturnType<typeof useStoryFlowActions>;
