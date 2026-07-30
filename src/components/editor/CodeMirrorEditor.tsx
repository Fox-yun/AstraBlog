"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

interface CodeMirrorEditorProps {
  value: string;
  onChange: (val: string) => void;
  onSave?: () => void;
}

export interface CodeMirrorEditorHandle {
  insertMarkdownBlock: (markdown: string) => void;
}

function markdownBlockInsertion(before: string, markdown: string, after: string) {
  const prefix =
    before.length === 0 || before.endsWith("\n\n")
      ? ""
      : before.endsWith("\n")
        ? "\n"
        : "\n\n";
  const suffix =
    after.startsWith("\n\n") ? "" : after.startsWith("\n") || after.length === 0 ? "\n" : "\n\n";

  return {
    text: `${prefix}${markdown}${suffix}`,
    cursorOffset: prefix.length + markdown.length,
  };
}

const CodeMirrorEditor = forwardRef<CodeMirrorEditorHandle, CodeMirrorEditorProps>(
  function CodeMirrorEditor({ value, onChange, onSave }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<any>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);

  // Keep callbacks current without rebuilding CodeMirror on every parent render.
  useEffect(() => {
    onChangeRef.current = onChange;
    onSaveRef.current = onSave;
  }, [onChange, onSave]);

  // Sync value updates without re-instantiating the editor view
  useEffect(() => {
    valueRef.current = value;
    if (viewRef.current) {
      const stateDoc = viewRef.current.state.doc.toString();
      if (stateDoc !== value) {
        viewRef.current.dispatch({
          changes: { from: 0, to: stateDoc.length, insert: value },
        });
      }
    }
  }, [value]);

  useImperativeHandle(
    ref,
    () => ({
      insertMarkdownBlock(markdown) {
        const editorView = viewRef.current;

        if (!editorView) {
          const current = valueRef.current;
          const insertion = markdownBlockInsertion(current, markdown, "");
          const nextValue = `${current}${insertion.text}`;
          valueRef.current = nextValue;
          onChangeRef.current(nextValue);
          return;
        }

        const selection = editorView.state.selection.main;
        const before = editorView.state.doc.sliceString(0, selection.from);
        const after = editorView.state.doc.sliceString(selection.to);
        const insertion = markdownBlockInsertion(before, markdown, after);

        editorView.dispatch({
          changes: {
            from: selection.from,
            to: selection.to,
            insert: insertion.text,
          },
          selection: {
            anchor: selection.from + insertion.cursorOffset,
          },
          scrollIntoView: true,
        });
        editorView.focus();
      },
    }),
    [],
  );

  useEffect(() => {
    if (!containerRef.current) return;

    let destroyed = false;
    let view: any = null;

    // Load CodeMirror 6 packages dynamically on the client
    Promise.all([
      import("codemirror"),
      import("@codemirror/lang-markdown"),
      import("@codemirror/commands"),
      import("@codemirror/state"),
      import("@codemirror/view"),
    ])
      .then(([cm, cmMarkdown, cmCommands, cmState, cmView]) => {
        if (destroyed || !containerRef.current) return;

        const startState = cmState.EditorState.create({
          doc: valueRef.current,
          extensions: [
            cm.basicSetup,
            cmMarkdown.markdown(),
            cmView.EditorView.lineWrapping,
            cmView.EditorView.theme(
              {
                "&": {
                  color: "var(--color-text-primary)",
                  backgroundColor: "var(--color-bg-void)",
                },
                ".cm-content": { caretColor: "var(--color-accent-amber)" },
                ".cm-cursor, .cm-dropCursor": {
                  borderLeftColor: "var(--color-accent-amber)",
                },
                "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
                  backgroundColor: "var(--color-border-base)",
                },
                ".cm-gutters": {
                  backgroundColor: "var(--color-bg-surface)",
                  color: "var(--color-text-muted)",
                  borderRight: "1px solid var(--color-border-base)",
                },
                ".cm-activeLineGutter": {
                  backgroundColor: "var(--color-border-base)",
                  color: "var(--color-accent-amber)",
                },
                ".cm-activeLine": {
                  backgroundColor: "color-mix(in srgb, var(--color-bg-surface) 70%, transparent)",
                },
              },
              { dark: true },
            ),
            cmView.EditorView.updateListener.of((update) => {
              if (update.docChanged) {
                const val = update.state.doc.toString();
                valueRef.current = val;
                onChangeRef.current(val);
              }
            }),
            cmView.keymap.of([
              ...cmCommands.defaultKeymap,
              {
                key: "Mod-s",
                run: () => {
                  if (onSaveRef.current) {
                    onSaveRef.current();
                    return true;
                  }
                  return false;
                },
              },
            ]),
          ],
        });

        view = new cmView.EditorView({
          state: startState,
          parent: containerRef.current,
        });

        viewRef.current = view;
      })
      .catch((err) => {
        console.error("CodeMirror failed to mount:", err);
      });

    return () => {
      destroyed = true;
      if (view) {
        view.destroy();
      }
      viewRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full min-w-0 max-w-full h-[500px] border border-border-base font-mono text-xs overflow-hidden bg-bg-void text-text-primary [&_.cm-editor]:h-full [&_.cm-editor]:outline-none"
    />
  );
  },
);

export default CodeMirrorEditor;
