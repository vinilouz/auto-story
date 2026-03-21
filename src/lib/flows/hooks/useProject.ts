import { useRef, useState } from "react";

export function useProject() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const saveQueue = useRef<Promise<any>>(Promise.resolve());

  const load = async (id: string) => {
    const res = await fetch(`/api/projects/${id}`);
    if (res.status === 404) {
      setProjectId(id);
      return null;
    }
    if (!res.ok) throw new Error("Load failed");
    const data = await res.json();
    setProjectId(data.id);
    return data;
  };

  const save = async (data: Record<string, any>) => {
    setIsSaving(true);

    const task = saveQueue.current
      .then(async () => {
        try {
          const res = await fetch("/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: projectId, ...data }),
          });
          if (!res.ok) throw new Error("Save failed");
          const saved = await res.json();
          setProjectId(saved.id);
          return saved;
        } finally {
          setIsSaving(false);
        }
      })
      .catch((e) => {
        setIsSaving(false);
        throw e;
      });

    saveQueue.current = task.catch(() => { });
    return task;
  };

  return { projectId, setProjectId, load, save, isSaving };
}
