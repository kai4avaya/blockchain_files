import { Extension } from '@codemirror/state'
import * as Y from 'yjs'

export interface Block {
  id: string
  type: string
  version: number
  content: unknown
  metadata?: Record<string, unknown>
}

export interface BlockHandler {
  type: string
  serialize: (content: unknown) => string
  deserialize: (data: string) => unknown
  getExtensions: () => Extension[]
}

export interface BlockChange {
  type: 'insert' | 'delete' | 'update'
  index: number
  block?: Y.Map<unknown>
  count?: number
  content?: string
}

export type BlockMap = Y.Map<unknown>
export type BlockArray = Y.Array<BlockMap>