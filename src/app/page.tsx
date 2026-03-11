"use client";

import { BookOpen, MessageSquare, Trash2, Video } from "lucide-react";
import { useEffect, useState } from "react";
import StoryFlow from "@/components/StoryFlow";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type FlowType = "simple" | "commentator" | "video-story";

interface Project {
  id: string;
  name: string;
  flowType: string;
  createdAt: string;
  updatedAt: string;
  commentator?: any;
}

export default function Home() {
  const [flow, setFlow] = useState<{
    type: FlowType;
    projectId?: string;
  } | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pId = params.get("projectId");
    const type = params.get("type") as FlowType;
    if (pId && type) {
      setFlow({ projectId: pId, type });
    }
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok)
        setProjects(
          (await res.json()).sort(
            (a: Project, b: Project) =>
              +new Date(b.updatedAt) - +new Date(a.updatedAt),
          ),
        );
    } catch {}
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this project?")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    setProjects((p) => p.filter((x) => x.id !== id));
  };

  const detectFlowType = (p: Project): FlowType => {
    if (p.flowType === "video-story") return "video-story";
    if (p.flowType === "with-commentator" || p.commentator)
      return "commentator";
    return "simple";
  };

  const startFlow = (type: FlowType, projectId?: string) => {
    const id = projectId || crypto.randomUUID();
    window.history.pushState(null, "", `?projectId=${id}&type=${type}`);
    setFlow({ type, projectId: id });
  };

  const closeFlow = () => {
    window.history.pushState(null, "", window.location.pathname);
    setFlow(null);
    loadProjects();
  };

  if (flow) {
    return (
      <StoryFlow
        mode={flow.type}
        projectId={flow.projectId!}
        onBack={closeFlow}
      />
    );
  }

  const flowIcon = (type: string) => {
    if (type === "video-story")
      return <Video className="w-4 h-4 text-purple-500" />;
    if (type === "with-commentator")
      return <MessageSquare className="w-4 h-4 text-green-500" />;
    return <BookOpen className="w-4 h-4 text-blue-500" />;
  };

  const flowLabel = (type: string) => {
    if (type === "video-story") return "Video Story";
    if (type === "with-commentator") return "Commentator";
    return "Simple";
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-4">Auto Story</h1>
        <p className="text-xl text-muted-foreground text-center mb-12">
          Create or continue a story
        </p>

        {projects.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">Saved Projects</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((p) => (
                <Card
                  key={p.id}
                  className="cursor-pointer hover:scale-[1.02] hover:shadow-lg transition-all group"
                  onClick={() => startFlow(detectFlowType(p), p.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex justify-between">
                      <div className="flex items-center gap-2">
                        {flowIcon(p.flowType)}
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {flowLabel(p.flowType)}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 h-8 w-8"
                        onClick={(e) => handleDelete(e, p.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                    <CardTitle className="text-lg line-clamp-2">
                      {p.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>
                      {new Date(p.updatedAt).toLocaleDateString()}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <h2 className="text-2xl font-semibold mb-6">New Story</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <Card
            className="cursor-pointer hover:scale-105 hover:shadow-lg transition-all"
            onClick={() => startFlow("simple")}
          >
            <CardHeader>
              <div className="text-4xl mb-4">📖</div>
              <CardTitle className="text-2xl">Simple Story</CardTitle>
              <CardDescription>Text → images → audio → video</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" size="lg">
                Start
              </Button>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:scale-105 hover:shadow-lg transition-all"
            onClick={() => startFlow("commentator")}
          >
            <CardHeader>
              <div className="text-4xl mb-4">🎙️</div>
              <CardTitle className="text-2xl">With Commentator</CardTitle>
              <CardDescription>Add a commentator character</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" size="lg">
                Start
              </Button>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:scale-105 hover:shadow-lg transition-all"
            onClick={() => startFlow("video-story")}
          >
            <CardHeader>
              <div className="text-4xl mb-4">🎬</div>
              <CardTitle className="text-2xl">Video Story</CardTitle>
              <CardDescription>
                AI video clips (Grok/Veo) from audio
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" size="lg">
                Start
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
