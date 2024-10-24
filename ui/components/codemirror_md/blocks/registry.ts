import { BlockHandler } from './types'

export class BlockRegistry {
  private handlers: Map<string, BlockHandler> = new Map()

  register(handler: BlockHandler): void {
    this.handlers.set(handler.type, handler)
  }

  getHandler(type: string): BlockHandler | undefined {
    return this.handlers.get(type)
  }

  getAllHandlers(): BlockHandler[] {
    return Array.from(this.handlers.values())
  }
}

// Create singleton instance
export const blockRegistry = new BlockRegistry()