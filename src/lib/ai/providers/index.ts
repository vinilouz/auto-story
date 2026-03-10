// Side-effect imports: register all providers on first import
import './void'
import './naga'
import './air'

// Re-export execution functions
export { execute } from '@/lib/ai/registry'
export { executeBatch } from '@/lib/ai/queue'