import { Extension, StateEffect, StateField, ChangeDesc, ChangeSet, Transaction } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

// Effect to handle document cleanup
const cleanupEffect = StateEffect.define<void>()

export const createSafetyExtension = (): Extension => {
  const safeguardEffect = StateEffect.define<{from: number, to: number, insert: string}>()

  const safeguardField = StateField.define({
    create() { return null },
    update(value, tr) {
      for (let effect of tr.effects) {
        if (effect.is(cleanupEffect)) {
          try {
            // Safely reset document state
            const docLength = tr.state.doc.length
            if (docLength > 0) {
              tr.state.update({
                changes: { from: 0, to: docLength, insert: '' },
                selection: { anchor: 0, head: 0 },
                annotations: [Transaction.addToHistory.of(false)]
              })
            }
          } catch (e) {
            console.warn('Failed to cleanup document:', e)
          }
          return null
        }
      }
      return value
    }
  })

  return [
    safeguardField,
    EditorView.updateListener.of(update => {
      if (update.docChanged) {
        try {
          const docLength = update.state.doc.length
          const changes = update.changes
          
          // Safety check for document length mismatch
          if (docLength < 0 || isNaN(docLength)) {
            console.warn('Invalid document length detected')
            update.view.dispatch({
              effects: cleanupEffect.of(undefined)
            })
            return
          }

          // Create changeset with proper length validation
          let changeSet: ChangeSet
          try {
            changeSet = changes instanceof ChangeSet ? 
              changes : 
              ChangeSet.of(changes, Math.max(0, docLength))
          } catch (e) {
            console.warn('Failed to create changeset:', e)
            return
          }

          // Track deletion state
          let hasInvalidChanges = false
          let isFullDeletion = false

          try {
            changeSet.iterChanges((fromA, toA, fromB, toB) => {
              // Check for invalid positions
              if (fromA < 0 || toA > docLength || fromB < 0 || toB > docLength) {
                hasInvalidChanges = true
                return
              }

              // Check for full document deletion
              if (fromA === 0 && toA === docLength && toB === 0) {
                isFullDeletion = true
              }
            })
          } catch (e) {
            console.warn('Error during change iteration:', e)
            hasInvalidChanges = true
          }

          // Handle invalid changes
          if (hasInvalidChanges) {
            console.warn('Invalid changes detected, attempting recovery')
            update.view.dispatch({
              effects: cleanupEffect.of(undefined)
            })
            return
          }

          // Handle full deletion
          if (isFullDeletion) {
            update.view.dispatch({
              changes: { from: 0, to: docLength, insert: '' },
              selection: { anchor: 0, head: 0 }
            })
            return
          }

          // Validate selection
          const selection = update.state.selection.main
          if (selection.head > docLength || selection.anchor > docLength) {
            update.view.dispatch({
              selection: { anchor: docLength, head: docLength }
            })
          }

        } catch (error) {
          console.error('Safety extension error:', error)
          // Emergency cleanup
          try {
            update.view.dispatch({
              effects: cleanupEffect.of(undefined)
            })
          } catch (e) {
            console.error('Emergency cleanup failed:', e)
          }
        }
      }
    })
  ]
}

// Simpler version with enhanced safety checks
export const simpleSafetyExtension = (): Extension => {
  return EditorView.updateListener.of(update => {
    if (update.docChanged) {
      try {
        const docLength = Math.max(0, update.state.doc.length)
        const changes = update.changes

        // Basic safety check
        if (docLength < 0 || isNaN(docLength)) {
          update.view.dispatch({
            changes: { from: 0, to: update.state.doc.length, insert: '' },
            selection: { anchor: 0, head: 0 }
          })
          return
        }

        let changeSet: ChangeSet
        try {
          changeSet = changes instanceof ChangeSet ? 
            changes : 
            ChangeSet.of(changes, docLength)
        } catch (e) {
          console.warn('Failed to create changeset:', e)
          return
        }

        let needsCleanup = false
        changeSet.iterChanges((fromA, toA, fromB, toB) => {
          if (fromA < 0 || toA > docLength || fromB < 0 || toB > docLength) {
            needsCleanup = true
          }
        })

        if (needsCleanup) {
          update.view.dispatch({
            changes: { from: 0, to: docLength, insert: '' },
            selection: { anchor: 0, head: 0 }
          })
        }

      } catch (error) {
        console.warn('Simple safety extension error:', error)
        update.view.dispatch({
          changes: { from: 0, to: update.state.doc.length, insert: '' },
          selection: { anchor: 0, head: 0 }
        })
      }
    }
  })
}