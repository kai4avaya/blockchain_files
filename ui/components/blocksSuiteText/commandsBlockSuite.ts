import { CommandManager } from '@blocksuite/block-std';
import { Text } from '@blocksuite/store';

// Define the AI API command
const sendTextToAI: 
Command<'text', 'responseText'> = async (ctx, next) => {
  const { text } = ctx;
  try {
    // Call your AI API with the extracted text
    const response = await fetch('https://your-ai-api.com/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: text }),
    });
    const data = await response.json();

    // Check if the response was successful
    if (response.ok) {
      // Return the response text from the AI and continue the chain
      return next({ responseText: data.response });
    } else {
      console.error('AI API failed:', data);
    }
  } catch (error) {
    console.error('Failed to call AI API:', error);
  }

  // If the command fails, return without calling next
  return;
};

// Register the command in the global BlockSuite.Commands namespace
declare global {
  namespace BlockSuite {
    interface Commands {
      'sendTextToAI': typeof sendTextToAI;
    }
  }
}

// Export a function to register the command with the CommandManager
export function registerCommands(commandManager: CommandManager) {
  commandManager.add('sendTextToAI', sendTextToAI);
}


