import { BlockHandler } from '../types'
import { markdown } from '@codemirror/lang-markdown'
import { Extension } from '@codemirror/state'

export class MarkdownBlockHandler implements BlockHandler {
  type = 'markdown'

  serialize(content: unknown): string {
    return JSON.stringify({
      markdown: content,
      metadata: {
        lastUpdated: new Date().toISOString()
      }
    })
  }

  deserialize(data: string): unknown {
    const parsed = JSON.parse(data)
    return parsed.markdown
  }

  getExtensions(): Extension[] {
    return [markdown()]
  }
}

// Register the handler
import { blockRegistry } from '../registry'
blockRegistry.register(new MarkdownBlockHandler())