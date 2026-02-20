import { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Save, Loader2, Play, ChevronRight, ChevronLeft } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollToTop } from "@/components/shared/ScrollToTop"

interface StoryFlowBaseProps {
  title: string
  steps: string[]
  currentStep: number
  maxStep?: number
  onStepClick?: (index: number) => void
  onBack: () => void
  onSave?: () => void
  isSaving?: boolean
  canSave?: boolean

  // New Execution Controls
  onExecute?: () => void
  isExecuting?: boolean
  canExecute?: boolean
  executeLabel?: string

  // Navigation Controls
  onNext?: () => void
  canNext?: boolean
  onPrevious?: () => void
  canPrevious?: boolean

  children: ReactNode
  className?: string
}

export function StoryFlowBase({
  title,
  steps,
  currentStep,
  maxStep,
  onStepClick,
  onBack,
  onSave,
  isSaving = false,
  canSave = true,

  onExecute,
  isExecuting = false,
  canExecute = false,
  executeLabel = "Executar",

  onNext,
  canNext = false,
  onPrevious,
  canPrevious = false,

  children,
  className = ""
}: StoryFlowBaseProps) {
  return (
    <div className={`min-h-screen bg-background pb-32 ${className}`}>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <header className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-2xl font-bold">{title}</h1>
          </div>
          {onSave && (
            <Button
              onClick={onSave}
              disabled={!canSave || isSaving}
              variant="outline"
              className="flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar
            </Button>
          )}
        </header>

        <Tabs
          value={currentStep.toString()}
          onValueChange={(val) => onStepClick?.(parseInt(val))}
          className="w-full mb-8"
        >
          <TabsList className="w-full h-auto flex-wrap justify-start sm:justify-between p-1">
            {steps.map((step, index) => {
              const isClickable = !!onStepClick && (maxStep !== undefined ? index <= maxStep : index <= currentStep)
              return (
                <TabsTrigger
                  key={step}
                  value={index.toString()}
                  disabled={!isClickable}
                  className="flex-1 py-2 text-xs sm:text-sm truncate data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {index + 1}. {step}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>

        <main>
          {children}
        </main>

        <ScrollToTop />
      </div>

      {/* Global Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background/80 backdrop-blur-md z-40 p-4 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <Button
            variant="outline"
            onClick={onPrevious}
            disabled={!canPrevious}
            className="w-32"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>

          <div className="flex-1 flex justify-center">
            {onExecute && (
              <Button
                size="lg"
                onClick={onExecute}
                disabled={!canExecute || isExecuting}
                className="w-full max-w-sm font-semibold rounded-full shadow-lg"
              >
                {isExecuting ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <Play className="w-5 h-5 mr-2" />
                )}
                {executeLabel}
              </Button>
            )}
          </div>

          <Button
            onClick={onNext}
            disabled={!canNext}
            variant={canNext ? "default" : "secondary"}
            className={`w-32 transition-all duration-300 ${canNext
              ? "shadow-md ring-2 ring-primary/20 ring-offset-2 ring-offset-background"
              : "opacity-40 grayscale"
              }`}
          >
            Avançar
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  )
}
