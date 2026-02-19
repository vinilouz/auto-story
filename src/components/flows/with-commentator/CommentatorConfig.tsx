'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Upload, Sparkles, Save } from 'lucide-react'

export interface CommentatorConfig {
  id: string
  name: string
  personality: string
  appearance: {
    type: 'upload' | 'generated'
    imageUrl?: string
    imagePrompt?: string
  }
}

interface CommentatorConfigProps {
  onSave: (config: CommentatorConfig) => void
  onCancel: () => void
  initialData?: CommentatorConfig | null
}

export default function CommentatorConfig({ onSave, onCancel, initialData }: CommentatorConfigProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'generate'>((initialData?.appearance.type === 'generated' ? 'generate' : 'upload'))
  const [isSaving, setIsSaving] = useState(false)

  // Form state
  const [name, setName] = useState(initialData?.name || '')
  const [personality, setPersonality] = useState(initialData?.personality || '')
  const [uploadedImage, setUploadedImage] = useState<string | null>(
    initialData?.appearance.type === 'upload' ? initialData.appearance.imageUrl || null : null
  )
  const [generatedImagePrompt, setGeneratedImagePrompt] = useState(initialData?.appearance.imagePrompt || '')
  const [generatedImage, setGeneratedImage] = useState<string | null>(
    initialData?.appearance.type === 'generated' ? initialData.appearance.imageUrl || null : null
  )

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setUploadedImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleGenerateImage = async () => {
    if (!generatedImagePrompt.trim()) return

    setIsSaving(true)
    try {
      const res = await fetch('/api/generate/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imagePrompt: generatedImagePrompt,
        }),
      })

      if (!res.ok) throw new Error('Failed to generate image')

      const data = await res.json()
      if (data.imageUrl) {
        setGeneratedImage(data.imageUrl)
      }
    } catch (error) {
      console.error('Error generating image:', error)
      alert('Failed to generate image. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSave = () => {
    if (!name.trim()) {
      alert('Please enter a name for the commentator')
      return
    }

    const config: CommentatorConfig = {
      id: Date.now().toString(),
      name: name.trim(),
      personality: personality.trim(),
      appearance: {
        type: activeTab === 'generate' ? 'generated' : 'upload',
        imageUrl: activeTab === 'upload' ? (uploadedImage || undefined) : (generatedImage || undefined),
        imagePrompt: activeTab === 'generate' ? generatedImagePrompt : undefined
      }
    }

    onSave(config)
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Configurar Comentador</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Info */}
        <div className="grid gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nome do Comentador</label>
            <Input
              placeholder="Ex: Professor Joana"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Personalidade</label>
            <Textarea
              placeholder="Descreva a personalidade do comentador..."
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              rows={3}
            />
          </div>

        </div>

        {/* Image Configuration */}
        <div className="space-y-4">
          <label className="text-sm font-medium">Aparência do Comentador</label>
          <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload" className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload
              </TabsTrigger>
              <TabsTrigger value="generate" className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Gerar com IA
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-4">
              <div className="border-2 border-dashed border-border rounded-lg p-6">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  {uploadedImage ? (
                    <img
                      src={uploadedImage}
                      alt="Uploaded"
                      className="w-32 h-32 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-32 h-32 bg-muted rounded-lg flex items-center justify-center">
                      <Upload className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                  <span className="text-sm text-muted-foreground">
                    Clique para upload de imagem
                  </span>
                </label>
              </div>
            </TabsContent>

            <TabsContent value="generate" className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Descrição para Geração</label>
                <Textarea
                  placeholder="Descreva como o comentador deve aparecer..."
                  value={generatedImagePrompt}
                  onChange={(e) => setGeneratedImagePrompt(e.target.value)}
                  rows={3}
                />
              </div>
              <Button
                onClick={handleGenerateImage}
                disabled={!generatedImagePrompt.trim() || isSaving}
                className="w-full"
              >
                {isSaving ? 'Gerando...' : 'Gerar Imagem'}
              </Button>
              {generatedImage && (
                <div className="flex justify-center">
                  <img
                    src={generatedImage}
                    alt="Generated"
                    className="w-32 h-32 object-cover rounded-lg"
                  />
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4">
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1"
            disabled={!name.trim() || (activeTab === 'upload' ? !uploadedImage : !generatedImage)}
          >
            <Save className="w-4 h-4 mr-2" />
            Salvar Comentador
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}