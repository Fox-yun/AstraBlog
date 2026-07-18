"use client";

import { useEffect, useRef } from "react";

interface CodeMirrorEditorProps {
  value: string;
  onChange: (val: string) => void;
  onSave?: () => void;
}

export default function CodeMirrorEditor({ value, onChange, onSave }: CodeMirrorEditorProps) {
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
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full min-w-0 max-w-full h-[500px] border border-border-base font-mono text-xs overflow-hidden bg-bg-void text-text-primary [&_.cm-editor]:h-full [&_.cm-editor]:outline-none"
    />
  );
}
