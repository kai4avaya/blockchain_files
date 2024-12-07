import { EditorView } from '@codemirror/view'

interface SafeChange {
  from: number
  to?: number
  insert: string
  scrollIntoView?: boolean
}

export const safetyUtils = {
  /**
   * Safely dispatch changes to the editor
   */
  safeDispatch(view: EditorView, changes: SafeChange): boolean {
    try {
      const docLength = view.state.doc.length
      
      // Special handling for empty document
      if (docLength === 0) {
        view.dispatch({
          changes: {
            from: 0,
            insert: changes.insert
          },
          scrollIntoView: changes.scrollIntoView
        });
        return true;
      }

      const safeChanges = {
        from: Math.min(changes.from, docLength),
        to: changes.to !== undefined ? Math.min(changes.to, docLength) : undefined,
        insert: changes.insert
      }

      // Validate changes before dispatch
      if (safeChanges.from < 0 || (safeChanges.to !== undefined && safeChanges.to < safeChanges.from)) {
        console.warn('Invalid change positions:', safeChanges)
        return false
      }

      // Only dispatch if the changes are valid
      if (safeChanges.from <= docLength && (!safeChanges.to || safeChanges.to <= docLength)) {
        view.dispatch({ 
          changes: safeChanges, 
          scrollIntoView: changes.scrollIntoView 
        })
        return true
      }

      console.warn('Change positions out of bounds:', {
        changes: safeChanges,
        docLength
      })
      return false

    } catch (error) {
      console.warn('Safe dispatch prevented error:', error)
      
      // Fallback: append to end of document
      try {
        view.dispatch({
          changes: { 
            from: view.state.doc.length, 
            insert: changes.insert 
          },
          scrollIntoView: changes.scrollIntoView
        })
        return true
      } catch (fallbackError) {
        console.error('Failed to apply fallback change:', fallbackError)
        return false
      }
    }
  },

  /**
   * Safely get a position within document bounds
   */
  safePosition(pos: number, view: EditorView): number {
    return Math.max(0, Math.min(pos, view.state.doc.length))
  },

  /**
   * Safely get a line from the document with additional validation
   */
  safeLine(pos: number, view: EditorView) {
    // If document is empty, return first line
    if (view.state.doc.length === 0) {
      return view.state.doc.line(1);
    }
    
    const safePos = this.safePosition(pos, view);
    return view.state.doc.lineAt(safePos);
  },

  /**
   * Safely clear content between positions
   */
  safeClear(view: EditorView, from: number, to: number) {
    const docLength = view.state.doc.length
    const safeFrom = Math.min(from, docLength)
    const safeTo = Math.min(to, docLength)

    if (safeFrom < safeTo) {
      return this.safeDispatch(view, {
        from: safeFrom,
        to: safeTo,
        insert: ''
      })
    }
    return false
  },

  /**
   * Validates if the current position is still valid after text changes
   */
  validatePosition(pos: number, view: EditorView): boolean {
    const docLength = view.state.doc.length;
    return pos >= 0 && pos <= docLength;
  }
}
