'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import './editor.css';

interface Props {
  content:  string;
  onChange: (html: string) => void;
}

export default function TipTapEditor({ content, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Typography,
      Placeholder.configure({ placeholder: 'Mulai ketik isi bagian dokumen di sini...' }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'tiptap-body',
      },
    },
  });

  if (!editor) return null;

  const toolbarBtn = (label: string, action: () => void, active = false, title?: string) => (
    <button
      key={label}
      type="button"
      onClick={action}
      title={title || label}
      style={{
        padding: '5px 9px', border: 'none', cursor: 'pointer',
        borderRadius: 4, fontSize: 13, fontWeight: active ? 700 : 400,
        background: active ? 'var(--navy)' : 'transparent',
        color: active ? '#fff' : 'var(--ink)',
        transition: 'all .15s',
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="tiptap-wrap">
      <div className="tiptap-toolbar">
        {toolbarBtn('B', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'), 'Bold')}
        {toolbarBtn('I', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'), 'Italic')}
        {toolbarBtn('S', () => editor.chain().focus().toggleStrike().run(), editor.isActive('strike'), 'Strikethrough')}
        <div className="tbar-sep"></div>
        {toolbarBtn('H2', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }))}
        {toolbarBtn('H3', () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive('heading', { level: 3 }))}
        <div className="tbar-sep"></div>
        {toolbarBtn('≡', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'), 'Bullet List')}
        {toolbarBtn('1.', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'), 'Ordered List')}
        <div className="tbar-sep"></div>
        {toolbarBtn('⌧', () => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote'), 'Blockquote')}
        {toolbarBtn('---', () => editor.chain().focus().setHorizontalRule().run(), false, 'Horizontal Rule')}
        <div className="tbar-sep"></div>
        {toolbarBtn('↩', () => editor.chain().focus().undo().run(), false, 'Undo')}
        {toolbarBtn('↪', () => editor.chain().focus().redo().run(), false, 'Redo')}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
