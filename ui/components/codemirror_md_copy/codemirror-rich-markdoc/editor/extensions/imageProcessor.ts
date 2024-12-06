import { EditorView } from "@codemirror/view"
import indexDBOverlay from "../../../../../../memory/local/file_worker"
import { generateUniqueId } from "../../../../../../utils/utils"

export interface ImageProcessingResult {
  imageId: string;
  markdownText: string;
  dataUrl: string;
}

export async function processImageFile(file: File, view: EditorView, pos?: number): Promise<ImageProcessingResult> {
  console.log('Starting shared image processing for:', file.name)
  
  const imageId = `img_${generateUniqueId(8)}`
  const insertPos = pos ?? view.state.selection.main.head
  
  try {
    const result = await new Promise<ImageProcessingResult>((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onloadend = async () => {
        if (reader.result && typeof reader.result === 'string') {
          try {
            // Save to IndexedDB
            await indexDBOverlay.saveData('images', {
              id: imageId,
              data: reader.result,
              filename: file.name,
              createdAt: Date.now()
            })

            resolve({
              imageId,
              markdownText: `![${file.name}](indexdb://${imageId})\n`,
              dataUrl: reader.result
            })
          } catch (error) {
            reject(error)
          }
        }
      }
      
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    return result

  } catch (error) {
    console.error('Failed to process image:', error)
    throw error
  }
}