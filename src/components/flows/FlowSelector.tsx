'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trash2, BookOpen, MessageSquare } from 'lucide-react'
import SimpleStoryFlow from './simple/SimpleStoryFlow'
import WithCommentatorFlow from './with-commentator/WithCommentatorFlow'

interface Project {
  id: string
  name: string
  flowType: 'simple' | 'with-commentator'
  createdAt: string
  updatedAt: string
}

export default function FlowSelector() {
  const [selectedFlow, setSelectedFlow] = useState<'simple' | 'with-commentator' | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      const res = await fetch('/api/projects')
      if (res.ok) {
        const data = await res.json()
        setProjects(data.sort((a: Project, b: Project) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        ))
      }
    } catch (error) {
      console.error('Failed to load projects:', error)
    }
  }

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation()
    if (!confirm('Tem certeza que deseja excluir este projeto?')) return

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setProjects(projects.filter(p => p.id !== projectId))
      }
    } catch (error) {
      console.error('Delete error:', error)
    }
  }

  const handleLoadProject = (project: Project & { commentator?: any }) => {
    // Detect flow type for legacy projects
    let type = project.flowType
    if (!type) {
      if (project.commentator) {
        type = 'with-commentator'
      } else {
        type = 'simple'
      }
    }
    setSelectedFlow(type)
    setSelectedProject(project)
  }

  if (selectedFlow) {
    if (selectedFlow === 'simple') {
      return <SimpleStoryFlow onBack={() => { setSelectedFlow(null); setSelectedProject(null) }} projectId={selectedProject?.id} />
    } else {
      return <WithCommentatorFlow onBack={() => { setSelectedFlow(null); setSelectedProject(null) }} projectId={selectedProject?.id} />
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Auto Story</h1>
          <p className="text-xl text-muted-foreground">
            Continue sua história ou crie uma nova
          </p>
        </div>

        {/* Saved Projects Section */}
        {projects.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">Histórias Salvas</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <Card
                  key={project.id}
                  className="cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg group"
                  onClick={() => handleLoadProject(project)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {project.flowType === 'simple' ? (
                          <BookOpen className="w-5 h-5 text-blue-500" />
                        ) : (
                          <MessageSquare className="w-5 h-5 text-green-500" />
                        )}
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                          {project.flowType === 'simple' ? 'Simples' : 'Com Comentador'}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                        onClick={(e) => handleDeleteProject(e, project.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                    <CardTitle className="text-lg line-clamp-2">{project.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>
                      Atualizado em {new Date(project.updatedAt).toLocaleDateString('pt-BR')}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* New Stories Section */}
        <div>
          <h2 className="text-2xl font-semibold mb-6">Criar Nova História</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="cursor-pointer transition-all hover:scale-105 hover:shadow-lg">
              <CardHeader>
                <div className="text-4xl mb-4">📖</div>
                <CardTitle className="text-2xl">História Simples</CardTitle>
                <CardDescription className="text-base">
                  Transforme seu texto em uma história visualizada com áudio automaticamente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => setSelectedFlow('simple')}
                  className="w-full"
                  size="lg"
                >
                  Começar
                </Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer transition-all hover:scale-105 hover:shadow-lg">
              <CardHeader>
                <div className="text-4xl mb-4">🎙️</div>
                <CardTitle className="text-2xl">História com Comentador</CardTitle>
                <CardDescription className="text-base">
                  Adicione um comentador personalizado para dar vida extra à sua história
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => setSelectedFlow('with-commentator')}
                  className="w-full"
                  size="lg"
                >
                  Começar
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}