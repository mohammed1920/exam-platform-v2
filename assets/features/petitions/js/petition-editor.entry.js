import { Editor, Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';

const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [{
      types: ['textStyle'],
      attributes: {
        fontSize: {
          default: null,
          parseHTML: element => element.style.fontSize || null,
          renderHTML: attributes => attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {}
        }
      }
    }];
  }
});

const TextIndent = Extension.create({
  name: 'textIndent',
  addGlobalAttributes() {
    return [{
      types: ['paragraph'],
      attributes: {
        textIndent: {
          default: null,
          parseHTML: element => element.style.textIndent || null,
          renderHTML: attributes => attributes.textIndent ? { style: `text-indent: ${attributes.textIndent}` } : {}
        }
      }
    }];
  }
});

const extensions = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
  TextStyle,
  Color.configure({ types: ['textStyle'] }),
  Underline,
  FontSize,
  TextIndent,
  TextAlign.configure({ types: ['heading', 'paragraph'], defaultAlignment: 'right' })
];

function makeEditor(element, content, onUpdate, onFocus) {
  if (!element) return null;
  return new Editor({
    element,
    extensions,
    content: content || '<p></p>',
    autofocus: false,
    editorProps: {
      attributes: {
        class: 'tiptap mizan-tiptap-content',
        dir: 'rtl',
        role: 'textbox',
        'aria-multiline': 'true',
        spellcheck: 'true'
      },
      handleDOMEvents: {
        focus: () => { onFocus?.(); return false; }
      }
    },
    onUpdate: ({ editor }) => onUpdate?.(editor),
    onSelectionUpdate: ({ editor }) => onFocus?.(editor)
  });
}

function createPetitionEditor(options = {}) {
  const state = { active: null, destroyed: false };
  const body = makeEditor(
    options.bodyElement,
    options.bodyContent,
    editor => { state.active = editor; options.onUpdate?.(api); },
    editor => { state.active = body; options.onFocus?.(body); }
  );
  const lawyer = options.lawyerElement
    ? makeEditor(
        options.lawyerElement,
        options.lawyerContent || '<p>اسم المحامي</p>',
        editor => { state.active = editor; options.onUpdate?.(api); },
        editor => { state.active = lawyer; options.onFocus?.(lawyer); }
      )
    : null;
  state.active = body;
  const api = {
    body,
    lawyer,
    get active() { return state.active || body; },
    getBodyHTML() { return body?.getHTML() || ''; },
    getLawyerHTML() { return lawyer?.getHTML() || ''; },
    focus(target = 'body') {
      const instance = target === 'lawyer' && lawyer ? lawyer : body;
      state.active = instance;
      instance?.commands.focus();
      return instance;
    },
    setBodyHTML(html) { body?.commands.setContent(html || '<p></p>', false); },
    setLawyerHTML(html) { lawyer?.commands.setContent(html || '<p>اسم المحامي</p>', false); },
    setFontSize(size) {
      const instance = api.active;
      if (!instance) return;
      instance.chain().focus().setMark('textStyle', { fontSize: `${size}px` }).run();
    },
    setColor(color) {
      api.active?.chain().focus().setColor(color).run();
    },
    run(command, value) {
      const instance = api.active;
      if (!instance) return false;
      const chain = instance.chain().focus();
      const commands = {
        bold: () => chain.toggleBold().run(),
        italic: () => chain.toggleItalic().run(),
        underline: () => chain.toggleUnderline().run(),
        justifyRight: () => chain.setTextAlign('right').run(),
        justifyCenter: () => chain.setTextAlign('center').run(),
        justifyLeft: () => chain.setTextAlign('left').run(),
        insertUnorderedList: () => chain.toggleBulletList().run(),
        insertOrderedList: () => chain.toggleOrderedList().run(),
        undo: () => chain.undo().run(),
        redo: () => chain.redo().run(),
        indent: () => chain.updateAttributes('paragraph', { textIndent: value > 0 ? '2em' : '0' }).run()
      };
      return commands[command]?.() ?? false;
    },
    setTextSelection(from, to = from) {
      body?.commands.setTextSelection({ from, to });
    },
    positionAtDOM(node, offset) {
      try { return body?.view.posAtDOM(node, offset) ?? null; } catch { return null; }
    },
    destroy() {
      if (state.destroyed) return;
      state.destroyed = true;
      body?.destroy();
      lawyer?.destroy();
    }
  };
  return api;
}

window.MizanPetitionEditor = Object.freeze({ create: createPetitionEditor, version: '2.11.5' });
