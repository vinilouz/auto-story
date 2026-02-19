import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

interface FlowStepperProps {
  steps: string[]
  currentStep: number
  onStepClick?: (index: number) => void
  className?: string
}

export function FlowStepper({ steps, currentStep, onStepClick, className }: FlowStepperProps) {
  return (
    <div className={cn("w-full py-4", className)}>
      <div className="relative flex items-center justify-between w-full">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-muted -z-10 -translate-y-1/2" />
        <div
          className="absolute top-1/2 left-0 h-0.5 bg-primary -z-10 -translate-y-1/2 transition-all duration-300"
          style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
        />

        {steps.map((step, index) => {
          const isCompleted = index < currentStep
          const isCurrent = index === currentStep
          const isLast = index === steps.length - 1
          const isClickable = (index <= currentStep || isLast) && onStepClick

          return (
            <div
              key={step}
              className={cn(
                "flex flex-col items-center gap-2 bg-background px-2",
                isClickable && "cursor-pointer hover:opacity-80 transition-opacity"
              )}
              onClick={() => isClickable && onStepClick?.(index)}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                  isCompleted ? "bg-primary border-primary text-primary-foreground" :
                    isCurrent ? "border-primary text-primary" :
                      "border-muted text-muted-foreground bg-background"
                )}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : index + 1}
              </div>
              <span className={cn(
                "text-xs font-medium transition-colors duration-300",
                isCurrent ? "text-primary" : "text-muted-foreground"
              )}>
                {step}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
