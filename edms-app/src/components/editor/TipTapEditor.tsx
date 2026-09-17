'use client';

import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
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
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
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

  // Sinkronisasi isi saat content dari props berubah (misal fetchDoc selesai atau data dimuat)
  useEffect(() => {
    if (editor && content !== undefined && editor.getHTML() !== content) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  if (!editor) return null;

  const toolbarBtn = (label: string, action: () => void, active = false, title?: string) => (
    <button
      key={title || label}
      type="button"
      onClick={action}
      title={title || label}
      style={{
        padding: '5px 9px', border: 'none', cursor: 'pointer',
        borderRadius: 4, fontSize: 12.5, fontWeight: active ? 700 : 400,
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
        {toolbarBtn('+ Tabel', () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), false, 'Sisipkan Tabel')}
        {toolbarBtn('+Baris', () => editor.chain().focus().addRowAfter().run(), false, 'Tambah Baris di Bawah')}
        {toolbarBtn('-Baris', () => editor.chain().focus().deleteRow().run(), false, 'Hapus Baris')}
        {toolbarBtn('+Kolom', () => editor.chain().focus().addColumnAfter().run(), false, 'Tambah Kolom di Kanan')}
        {toolbarBtn('-Kolom', () => editor.chain().focus().deleteColumn().run(), false, 'Hapus Kolom')}
        <div className="tbar-sep"></div>
        {toolbarBtn('↩', () => editor.chain().focus().undo().run(), false, 'Undo')}
        {toolbarBtn('↪', () => editor.chain().focus().redo().run(), false, 'Redo')}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
