import { EditorState, Plugin } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Schema, DOMParser } from 'prosemirror-model';
import { schema, defaultMarkdownParser, defaultMarkdownSerializer } from 'prosemirror-markdown';
import { keymap } from 'prosemirror-keymap';  // Correct package for keymap
import { baseKeymap, toggleMark, setBlockType } from 'prosemirror-commands';
import { history } from 'prosemirror-history';
import { inputRules, wrappingInputRule, textblockTypeInputRule } from 'prosemirror-inputrules';

// Add a custom schema for the grey block
const mySchema = new Schema({
  nodes: schema.spec.nodes.addBefore('text', 'grey_block', {
    group: 'inline',
    content: 'text*',
    inline: true,
    atom: true,
    toDOM: () => ['span', { class: 'grey-block' }, 0],
    parseDOM: [{ tag: 'span.grey-block' }],
  }),
  marks: schema.spec.marks,
});

// Create an input rule for markdown headers
const headingRule = textblockTypeInputRule(/^#\s$/, mySchema.nodes.heading, { level: 1 });

const handleBackslashPlugin = new Plugin({
  props: {
    handleTextInput(view, from, to, text) {
      if (text === '\\') {
        const { state, dispatch } = view;
        const { $from } = state.selection;
        const startOfParagraph = $from.before($from.depth);
        const paragraphText = state.doc.textBetween(startOfParagraph, $from.pos, ' ');
        if (paragraphText.trim().endsWith('\\')) {
          const tr = state.tr.replaceRangeWith(
            startOfParagraph,
            $from.pos,
            mySchema.nodes.grey_block.create(null, state.schema.text(paragraphText.trim().slice(0, -1)))
          );
          dispatch(tr);
          console.log(paragraphText.trim().slice(0, -1));
          return true;
        }
      }
      return false;
    },
  },
});

// Initialize the ProseMirror editor
const editor = new EditorView(document.querySelector('#editor-container'), {
  state: EditorState.create({
    doc: DOMParser.fromSchema(mySchema).parse(document.querySelector('#editor-container')),
    plugins: [
      history(),
      keymap(baseKeymap),
      inputRules({ rules: [headingRule] }),
      handleBackslashPlugin,
    ],
  }),
});
