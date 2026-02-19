import { ArrowUp } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ScrollToTop() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="flex justify-center mt-8 pb-4">
      <Button variant="outline" size="icon" onClick={scrollToTop} className="rounded-full shadow-md hover:shadow-lg transition-all">
        <ArrowUp className="w-5 h-5" />
      </Button>
    </div>
  )
}
