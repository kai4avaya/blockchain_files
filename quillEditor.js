// import Quill from 'quill';
// import QuillMarkdown from 'quilljs-markdown';
// import 'quilljs-markdown/dist/quilljs-markdown-common-style.css';
// import "quill/dist/quill.core.css";
// // import ""

// export function editor() {
//   document.addEventListener("DOMContentLoaded", function() {
//     // Register the markdown module
//     Quill.register('modules/markdown', QuillMarkdown, true);

//     const quill = new Quill('#editor-container', {
//       theme: 'snow',
//       modules: {
//         toolbar: [
//           [{ 'header': [1, 2, false] }],
//           ['bold', 'italic', 'underline'],
//           ['link', 'blockquote', 'code-block'],
//           [{ 'list': 'ordered' }, { 'list': 'bullet' }],
//           ['clean']
//         ],
//         markdown: {}
//       }
//     });

//     // const chatSlideout = document.getElementById('chatSlideout');
//     // const toggleButton = document.getElementById('toggleButton');

//     // toggleButton.addEventListener('click', function() {
//     //   chatSlideout.classList.toggle('active');
//     // });

//     quill.on('text-change', function(delta, oldDelta, source) {
//       if (source === 'user') {
//         const text = quill.getText();
//         const lastIndex = text.lastIndexOf('\\');
//         if (lastIndex !== -1) {
//           const lastParagraph = text.substring(0, lastIndex).trim().split('\n').pop();
//           if (lastParagraph) {
//             generateAIText(lastParagraph).then(aiText => {
//               const range = quill.getSelection(true);
//               quill.deleteText(lastIndex, 1); // remove the backslash
//               quill.insertText(range.index, `\nAI: ${aiText}`, 'ai-text');
//             });
//           }
//         }
//       }
//     });

//     function generateAIText(inputText) {
//       // This is a placeholder function. Replace it with your AI generation logic.
//       return new Promise((resolve) => {
//         setTimeout(() => {
//           resolve("This is the generated AI text based on the last paragraph: " + inputText);
//         }, 1000);
//       });
//     }
//   });
// }


import Quill from 'quill';
import QuillMarkdown from 'quilljs-markdown';
import 'quilljs-markdown/dist/quilljs-markdown-common-style.css';
import 'quill/dist/quill.core.css';
import 'quill/dist/quill.snow.css'; // Add this line to import the snow theme CSS

export function editor() {
  document.addEventListener("DOMContentLoaded", function() {
    // Register the markdown module
    Quill.register('modules/markdown', QuillMarkdown, true);

    const quill = new Quill('#editor-container', {
      theme: 'snow',
      modules: {
        toolbar: [
          [{ 'header': [1, 2, false] }],
          ['bold', 'italic', 'underline'],
          ['link', 'blockquote', 'code-block'],
          [{ 'list': 'ordered' }, { 'list': 'bullet' }],
          ['clean']
        ],
        markdown: {}
      }
    });

    quill.on('text-change', function(delta, oldDelta, source) {
      if (source === 'user') {
        const text = quill.getText();
        const lastIndex = text.lastIndexOf('\\');
        if (lastIndex !== -1) {
          const lastParagraph = text.substring(0, lastIndex).trim().split('\n').pop();
          if (lastParagraph) {
            generateAIText(lastParagraph).then(aiText => {
              const range = quill.getSelection(true);
              quill.deleteText(lastIndex, 1); // remove the backslash
              quill.insertText(range.index, `\nAI: ${aiText}`, 'ai-text');
            });
          }
        }
      }
    });

    function generateAIText(inputText) {
      // This is a placeholder function. Replace it with your AI generation logic.
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve("This is the generated AI text based on the last paragraph: " + inputText);
        }, 1000);
      });
    }
  });
}
