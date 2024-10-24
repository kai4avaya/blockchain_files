// Function to stream AI response (you'll need to implement this)
async function streamAIResponse(query, callback) {
    // Implement your AI API call and streaming logic here
    // Call the callback function with chunks of text as they arrive
    // For now, let's simulate a response
    const response = `This is a simulated AI response to your query: "${query}"`;
    for (let i = 0; i < response.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 50)); // Simulate delay
      callback(response[i]);
    }
  }
  export const askAICommand = async (ctx) => {
    const { page } = ctx;
    
    // Get the current selection
    const selection = page.root.selection;
    if (!selection) return;
  
    // Get the block containing the cursor
    const block = page.root.getBlockById(selection.path[0]);
    if (!block || block.flavour !== 'affine:paragraph') return;
  
    // Extract the text before the cursor
    const text = block.text?.toString() || '';
    const cursorIndex = selection.from.index;
    const query = text.slice(0, cursorIndex).trim();
  
    // Create a new paragraph for the AI response
    const responseBlockId = page.addBlock('affine:paragraph', {}, block.id);
    const responseBlock = page.getBlockById(responseBlockId);
  
    // Simulate AI response (replace this with actual AI integration)
    const aiResponse = `This is a simulated AI response to: "${query}"`;
    responseBlock.text.insert(0, aiResponse);
  
    console.log('AI command executed');
  };