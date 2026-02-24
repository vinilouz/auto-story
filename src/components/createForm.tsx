"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Download, Loader2, Pencil, Check, X, RefreshCw, Save, FolderOpen, Trash2 } from "lucide-react"
import { cleanTitle } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

const DEFAULT_SEGMENT_SIZE = 150

interface GenerateResponse {
  segments: string[]
  visualDescriptions?: Array<{ imagePrompt: string; imageUrl?: string; status: 'pending' | 'generating' | 'completed' | 'error' }>
}

interface ProjectSummary {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export default function ScriptForm() {
  const [scriptText, setScriptText] = useState("")
  const [segmentSize, setSegmentSize] = useState([DEFAULT_SEGMENT_SIZE])
  const [response, setResponse] = useState<GenerateResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [audioResponse, setAudioResponse] = useState<{ audioUrls: string[] } | null>(null)
  const [isAudioLoading, setIsAudioLoading] = useState(false)
  const [loadingStage, setLoadingStage] = useState<'segmenting' | 'descriptions' | 'images' | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  // New state for editing and regeneration
  const [editingSegmentIndex, setEditingSegmentIndex] = useState<number | null>(null)
  const [editedPrompt, setEditedPrompt] = useState("")
  const [regeneratingSegmentIndex, setRegeneratingSegmentIndex] = useState<number | null>(null)

  // Project Management State
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  useEffect(() => {
    if (isSheetOpen) {
      loadProjectsList()
    }
  }, [isSheetOpen])

  const loadProjectsList = async () => {
    try {
      const res = await fetch("/api/projects")
      if (res.ok) {
        const data = await res.json()
        setProjects(data)
      }
    } catch (error) {
      console.error("Failed to load projects:", error)
    }
  }

  const handleSaveProject = async () => {
    if (!scriptText.trim()) return

    setIsSaving(true)
    try {
      const projectData = {
        id: currentProjectId,
        name: cleanTitle(scriptText),
        scriptText,
        segmentSize: segmentSize[0],
        segments: response?.segments,
        visualDescriptions: response?.visualDescriptions,
        audioUrls: audioResponse?.audioUrls
      }

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectData),
      })

      if (res.ok) {
        const savedProject = await res.json()
        setCurrentProjectId(savedProject.id)
        alert("Project saved successfully!")
      } else {
        throw new Error("Failed to save")
      }
    } catch (error) {
      console.error("Save error:", error)
      alert("Failed to save project")
    } finally {
      setIsSaving(false)
    }
  }

  const handleLoadProject = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`)
      if (res.ok) {
        const project = await res.json()
        setCurrentProjectId(project.id)
        setScriptText(project.scriptText)
        setSegmentSize([project.segmentSize])

        if (project.segments) {
          setResponse({
            segments: project.segments,
            visualDescriptions: project.visualDescriptions
          })
        } else {
          setResponse(null)
        }

        if (project.audioUrls) {
          setAudioResponse({ audioUrls: project.audioUrls })
        } else {
          setAudioResponse(null)
        }

        setIsSheetOpen(false)
      }
    } catch (error) {
      console.error("Load error:", error)
      alert("Failed to load project")
    }
  }

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm("Are you sure you want to delete this project?")) return

    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "DELETE"
      })

      if (res.ok) {
        setProjects(projects.filter(p => p.id !== id))
        if (currentProjectId === id) {
          setCurrentProjectId(null)
        }
      }
    } catch (error) {
      console.error("Delete error:", error)
    }
  }

  const handleGenerateAudio = async () => {
    if (!scriptText.trim()) return

    setIsAudioLoading(true)
    setAudioResponse(null)

    try {
      const res = await fetch("/api/generate/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: scriptText,
        }),
      })

      if (!res.ok) throw new Error("Failed to generate audio")
      const data = await res.json()
      if (data.batches) {
        setAudioResponse({ audioUrls: data.batches.map((b: any) => b.url).filter(Boolean) })
      }
    } catch (err) {
      console.error("Audio generation error:", err)
      alert("Failed to generate audio. Please try again.")
    } finally {
      setIsAudioLoading(false)
    }
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!scriptText.trim()) return

    setIsLoading(true)
    setIsAudioLoading(true)
    setLoadingStage('segmenting')
    setResponse(null)
    setAudioResponse(null)
    setEditingSegmentIndex(null)
    setRegeneratingSegmentIndex(null)
    setCurrentProjectId(null) // Reset current project ID on new generation

    // Trigger audio generation
    handleGenerateAudio()

    try {
      // Step 1: Split Script
      console.log('Step 1: Splitting script...')
      const splitRes = await fetch("/api/generate/split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: scriptText,
          segmentLength: segmentSize[0],
        }),
      })

      if (!splitRes.ok) throw new Error("Failed to split script")

      const splitData = await splitRes.json()
      setResponse({ segments: splitData.segments })

      // Step 2: Generate Descriptions
      setLoadingStage('descriptions')
      console.log('Step 2: Generating descriptions...')

      const descRes = await fetch("/api/generate/descriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segments: splitData.segments,
        }),
      })

      if (!descRes.ok) throw new Error("Failed to generate descriptions")

      const descData = await descRes.json()
      setResponse(prev => prev ? { ...prev, visualDescriptions: descData.visualDescriptions } : null)

      // Step 3: Generate Images
      setLoadingStage('images')
      console.log('Step 3: Generating images...')

      const imgRes = await fetch("/api/generate/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visualDescriptions: descData.visualDescriptions,
        }),
      })

      if (!imgRes.ok) throw new Error("Failed to generate images")

      const imgData = await imgRes.json()
      setResponse(prev => prev ? { ...prev, visualDescriptions: imgData.visualDescriptions } : null)

    } catch (error) {
      console.error("Error processing script:", error)
    } finally {
      setIsLoading(false)
      setLoadingStage(null)
    }

  }

  const handleDownloadZip = async () => {
    if (!response || !response.visualDescriptions) return

    setIsDownloading(true)

    try {
      const res = await fetch("/api/generate/zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visualDescriptions: response.visualDescriptions,
          segments: response.segments,
          audioUrls: audioResponse?.audioUrls // Include audio in zip if available
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to download ZIP")
      }

      // Get filename from Content-Disposition header or create default
      const contentDisposition = res.headers.get('content-disposition')
      const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/)
      const filename = filenameMatch?.[1] || `story-assets-${Date.now()}.zip`

      // Convert response to blob and download
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()

      // Cleanup
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

    } catch (error: any) {
      console.error("Download error:", error)
      alert(`Failed to download: ${error.message || "Unknown error"}`)
    } finally {
      setIsDownloading(false)
    }
  }

  const startEditing = (index: number, currentPrompt: string) => {
    setEditingSegmentIndex(index)
    setEditedPrompt(currentPrompt)
  }

  const cancelEditing = () => {
    setEditingSegmentIndex(null)
    setEditedPrompt("")
  }

  const savePrompt = (index: number) => {
    if (!response || !response.visualDescriptions) return

    const newDescriptions = [...response.visualDescriptions]
    newDescriptions[index] = {
      ...newDescriptions[index],
      imagePrompt: editedPrompt
    }

    setResponse({
      ...response,
      visualDescriptions: newDescriptions
    })
    setEditingSegmentIndex(null)
  }

  const handleRegenerate = async (index: number) => {
    if (!response || !response.visualDescriptions) return

    const descriptionToRegenerate = response.visualDescriptions[index]
    setRegeneratingSegmentIndex(index)

    // Update status to generating
    const newDescriptions = [...response.visualDescriptions]
    newDescriptions[index] = { ...descriptionToRegenerate, status: 'generating' }
    setResponse({ ...response, visualDescriptions: newDescriptions })

    try {
      const imgRes = await fetch("/api/generate/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visualDescriptions: [{ imagePrompt: descriptionToRegenerate.imagePrompt }],
        }),
      })

      if (!imgRes.ok) throw new Error("Failed to regenerate image")

      const imgData = await imgRes.json()

      if (imgData.visualDescriptions && imgData.visualDescriptions[0]) {
        const updatedDescriptions = [...response.visualDescriptions]
        updatedDescriptions[index] = imgData.visualDescriptions[0]
        setResponse({ ...response, visualDescriptions: updatedDescriptions })
      }

    } catch (error) {
      console.error("Error regenerating image:", error)
      // Revert status to error or previous state if possible, here just error
      const errorDescriptions = [...response.visualDescriptions]
      errorDescriptions[index] = { ...descriptionToRegenerate, status: 'error' }
      setResponse({ ...response, visualDescriptions: errorDescriptions })
    } finally {
      setRegeneratingSegmentIndex(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Auto Story Generator</h1>
        <div className="flex gap-2">
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4" />
                Load Project
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Saved Projects</SheetTitle>
                <SheetDescription>
                  Select a project to load.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-2">
                {projects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No saved projects found.</p>
                ) : (
                  projects.map((project) => (
                    <div
                      key={project.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer group"
                      onClick={() => handleLoadProject(project.id)}
                    >
                      <div className="overflow-hidden">
                        <p className="font-medium truncate">{project.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(project.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => handleDeleteProject(e, project.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </SheetContent>
          </Sheet>

          <Button
            onClick={handleSaveProject}
            disabled={!scriptText.trim() || isSaving}
            className="flex items-center gap-2"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Project
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Script Segmenter & Generator</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleFormSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="script" className="text-sm font-medium">
                Script Text
              </label>
              <Textarea
                id="script"
                placeholder="Enter your script here..."
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                className="min-h-32"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">
                Characters per segment: {segmentSize[0]}
              </label>
              <Slider
                value={segmentSize}
                onValueChange={setSegmentSize}
                max={500}
                min={100}
                step={10}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>100</span>
                <span>500</span>
              </div>
            </div>


            <Button
              type="submit"
              disabled={!scriptText.trim() || isLoading}
              className="w-full"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  <span>Processing Visuals...</span>
                </div>
              ) : (
                'Process Script'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Audio Results Section */}
      {(audioResponse || isAudioLoading || scriptText) && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Audio Generation</CardTitle>
            {!isAudioLoading && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateAudio}
                disabled={!scriptText.trim()}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {audioResponse ? 'Regenerate Audio' : 'Generate Audio'}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isAudioLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating audio narration...</span>
              </div>
            ) : audioResponse ? (
              <div className="space-y-4">
                {audioResponse.audioUrls.map((url, index) => (
                  <div key={index} className="flex items-center gap-4 p-3 border rounded-lg bg-muted/50">
                    <span className="text-sm font-medium">Part {index + 1}</span>
                    <audio controls src={url} className="w-full h-10" />
                    <a href={url} download={`narration-part-${index + 1}.mp3`}>
                      <Button size="icon" variant="ghost">
                        <Download className="w-4 h-4" />
                      </Button>
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No audio generated yet. Click "Generate Audio" to create narration for your script.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {response && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Script Segments</h2>
          <div className="grid gap-4">
            {response.segments.map((segment, index) => (
              <Card key={index}>
                <CardContent>
                  <div className="flex items-start gap-2">
                    <span className="text-sm font-medium text-muted-foreground min-w-8">
                      {index + 1}.
                    </span>
                    <p className="text-sm leading-relaxed">{segment}</p>
                  </div>

                  {response.visualDescriptions?.[index] && (
                    <div className="border-l-2 border-border pl-4 ml-2">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          Visual Description
                        </p>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded ${response.visualDescriptions[index].status === 'completed' ? 'bg-green-100 text-green-800' :
                            response.visualDescriptions[index].status === 'generating' ? 'bg-blue-100 text-blue-800' :
                              response.visualDescriptions[index].status === 'error' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                            }`}>
                            {response.visualDescriptions[index].status}
                          </span>

                          {/* Regenerate Button */}
                          {(response.visualDescriptions[index].status === 'completed' || response.visualDescriptions[index].status === 'error') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleRegenerate(index)}
                              disabled={regeneratingSegmentIndex === index}
                              title="Regenerate Image"
                            >
                              <RefreshCw className={`h-3 w-3 ${regeneratingSegmentIndex === index ? 'animate-spin' : ''}`} />
                            </Button>
                          )}
                        </div>
                      </div>

                      {editingSegmentIndex === index ? (
                        <div className="space-y-2 mb-3">
                          <Textarea
                            value={editedPrompt}
                            onChange={(e) => setEditedPrompt(e.target.value)}
                            className="text-sm"
                            rows={3}
                          />
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={cancelEditing}
                              className="h-7 px-2"
                            >
                              <X className="h-4 w-4 mr-1" /> Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => savePrompt(index)}
                              className="h-7 px-2"
                            >
                              <Check className="h-4 w-4 mr-1" /> Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="group relative mb-3">
                          <p className="text-sm text-foreground/80 italic pr-6">
                            {response.visualDescriptions[index].imagePrompt}
                          </p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-0 right-0 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => startEditing(index, response.visualDescriptions![index].imagePrompt)}
                            title="Edit Prompt"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                      )}

                      {/* Image Display */}
                      {response.visualDescriptions[index].status === 'completed' && response.visualDescriptions[index].imageUrl && (
                        <div className="mt-3">
                          <img
                            src={response.visualDescriptions[index].imageUrl}
                            alt={`Scene ${index + 1}`}
                            className="w-full max-w-md rounded-lg border border-border"
                          />
                        </div>
                      )}

                      {/* Image Generation Skeleton */}
                      {response.visualDescriptions[index].status === 'generating' && (
                        <div className="mt-3">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                            <span className="text-xs text-muted-foreground">Generating image...</span>
                          </div>
                          <Skeleton className="w-full h-64 rounded-lg" />
                        </div>
                      )}

                      {/* Error State */}
                      {response.visualDescriptions[index].status === 'error' && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-sm text-red-600">Failed to generate image</p>
                        </div>
                      )}

                      {/* Pending State */}
                      {response.visualDescriptions[index].status === 'pending' && (
                        <div className="mt-3">
                          <Skeleton className="w-full h-64 rounded-lg opacity-50" />
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Download Button Section */}
          {response.visualDescriptions && response.visualDescriptions.some(desc => desc.status === 'completed') && (
            <div className="flex justify-center pt-6 border-t border-border">
              <Button
                onClick={handleDownloadZip}
                disabled={isDownloading}
                variant="outline"
                size="lg"
                className="flex items-center gap-2"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Download All as ZIP
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}