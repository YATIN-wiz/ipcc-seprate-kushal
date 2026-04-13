import React, { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import {
  Camera,
  CheckCircle,
  CircleAlert,
  LayoutTemplate,
  Maximize2,
  Play,
  QrCode,
  RefreshCw,
} from 'lucide-react';

const meshBackground = {
  backgroundImage:
    'radial-gradient(at 0% 0%, hsla(213, 100%, 93%, 1) 0px, transparent 50%), radial-gradient(at 100% 0%, hsla(259, 100%, 95%, 1) 0px, transparent 50%), radial-gradient(at 100% 100%, hsla(339, 100%, 96%, 1) 0px, transparent 50%), radial-gradient(at 0% 100%, hsla(196, 100%, 92%, 1) 0px, transparent 50%)',
  backgroundColor: '#111827',
};

const defaultCode = `def min_cost_with_override(n, edges):
    # Write your logic here
    pass


def main():
    n, m = map(int, input().split())
    edges = [tuple(map(int, input().split())) for _ in range(m)]
    print(min_cost_with_override(n, edges))


if __name__ == "__main__":
    main()`;

const testCases = [
  { input: 'N=4, edges=[(0,1,4),(1,2,6),(2,3,3),(0,3,20)], K=2', expected: 7, status: 'Passed' },
  { input: 'N=5, edges=[(0,1,8),(1,2,2),(2,4,5),(0,3,7),(3,4,6)], K=2', expected: 7, status: 'Passed' },
  { input: 'N=6, edges=[(0,1,3),(1,2,9),(2,5,4),(0,3,5),(3,4,1),(4,5,12)], K=1', expected: 9, status: 'Passed' },
  { input: 'N=5, edges=[(0,1,2),(1,3,7),(3,4,1),(0,2,10),(2,4,2)], K=2', expected: 3, status: 'Passed' },
  { input: 'N=7, edges=[(0,1,6),(1,2,2),(2,6,9),(0,3,3),(3,4,4),(4,5,5),(5,6,1)], K=3', expected: 4, status: 'Passed' },
  { input: 'N=5, edges=[(0,1,7),(1,4,8),(0,2,4),(2,3,4),(3,4,4)], K=2', expected: 8, status: 'Failed' },
  { input: 'N=6, edges=[(0,1,5),(1,2,5),(2,3,5),(3,5,5),(0,4,14),(4,5,1)], K=2', expected: 6, status: 'Passed' },
  { input: 'N=6, edges=[(0,1,1),(1,2,20),(2,5,1),(0,3,9),(3,4,2),(4,5,2)], K=1', expected: 5, status: 'Passed' },
  { input: 'N=5, edges=[(0,1,3),(1,2,3),(2,3,3),(3,4,3),(0,4,30)], K=3', expected: 3, status: 'Passed' },
  { input: 'N=4, edges=[(0,1,9),(1,3,9),(0,2,4),(2,3,4)], K=1', expected: 8, status: 'Failed' },
];

export default function GlassExamInterface({ studentName = 'Divyansh Rai' }) {
  const [activeTab, setActiveTab] = useState('output');
  const [cameraActive, setCameraActive] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [language, setLanguage] = useState('python');
  const [fontSize, setFontSize] = useState(15);
  const [code, setCode] = useState(defaultCode);
  const [leftPaneWidth, setLeftPaneWidth] = useState(45);
  const [editorHeight, setEditorHeight] = useState(68);

  const layoutRef = useRef(null);
  const rightStackRef = useRef(null);
  const dragModeRef = useRef(null);

  useEffect(() => {
    const onMouseMove = (event) => {
      if (!dragModeRef.current) return;

      if (dragModeRef.current === 'vertical' && layoutRef.current) {
        const rect = layoutRef.current.getBoundingClientRect();
        const relativeX = event.clientX - rect.left;
        const minPx = 320;
        const maxPx = rect.width - 520;
        const clamped = Math.max(minPx, Math.min(maxPx, relativeX));
        setLeftPaneWidth((clamped / rect.width) * 100);
      }

      if (dragModeRef.current === 'horizontal' && rightStackRef.current) {
        const rect = rightStackRef.current.getBoundingClientRect();
        const relativeY = event.clientY - rect.top;
        const minPx = 180;
        const maxPx = rect.height - 160;
        const clamped = Math.max(minPx, Math.min(maxPx, relativeY));
        setEditorHeight((clamped / rect.height) * 100);
      }
    };

    const onMouseUp = () => {
      dragModeRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const startVerticalDrag = () => {
    dragModeRef.current = 'vertical';
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const startHorizontalDrag = () => {
    dragModeRef.current = 'horizontal';
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0b1220] font-sans text-slate-100 selection:bg-indigo-700/30 selection:text-indigo-100" style={meshBackground}>
      <header className="z-30 flex h-[84px] shrink-0 items-center justify-between border-b border-white/20 bg-white/12 px-8 py-4 shadow-[0_2px_20px_rgb(0,0,0,0.18)] backdrop-blur-xl">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 text-lg font-bold text-white shadow-lg shadow-blue-600/20">
              R
            </div>
            <div className="flex flex-col">
              <h1 className="text-[15px] font-extrabold tracking-tight text-slate-50">RNSIT Proctoring System</h1>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">Secure Exam Core v2.0</span>
            </div>
          </div>
          <div className="mx-2 h-6 w-px bg-white/20" />
          <div className="flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-500/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-200">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
            AI Monitored
          </div>
        </div>

        <div className="absolute left-1/2 flex items-center gap-4 -translate-x-1/2 transform">
          <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/15 px-4 py-2 text-sm font-semibold text-slate-100 shadow-sm backdrop-blur-md">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs">👤</span>
            {studentName}
          </div>
          <div className="rounded-xl border border-slate-600 bg-slate-900 px-5 py-2 font-mono text-sm font-bold tracking-widest text-white shadow-md">
            00:18:22
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setCameraActive((prev) => !prev);
                setShowQR(false);
              }}
              className={`rounded-xl border p-2.5 transition-all duration-200 ${cameraActive ? 'scale-105 border-indigo-500 bg-indigo-500 text-white shadow-lg shadow-indigo-600/30' : 'border-white/25 bg-white/12 text-slate-100 shadow-sm backdrop-blur-md hover:bg-white/20'}`}
            >
              <Camera size={18} />
            </button>

            {cameraActive && (
              <div className="absolute left-1/2 top-14 z-50 flex h-40 w-56 -translate-x-1/2 transform flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-slate-900/75 text-xs text-slate-300 shadow-2xl ring-1 ring-white/10 backdrop-blur-2xl">
                <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 to-transparent" />
                <Camera size={28} className="mb-3 text-white opacity-40" />
                <span className="font-medium tracking-wide">Initializing LiveKit...</span>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowQR((prev) => !prev);
                setCameraActive(false);
              }}
              className={`rounded-xl border p-2.5 transition-all duration-200 ${showQR ? 'scale-105 border-slate-700 bg-slate-800 text-white shadow-lg shadow-slate-800/30' : 'border-white/25 bg-white/12 text-slate-100 shadow-sm backdrop-blur-md hover:bg-white/20'}`}
            >
              <QrCode size={18} />
            </button>

            {showQR && (
              <div className="absolute left-1/2 top-14 z-50 flex w-56 -translate-x-1/2 transform flex-col items-center rounded-2xl border border-white/20 bg-white/88 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.2)] ring-1 ring-slate-900/5 backdrop-blur-2xl">
                <div className="mb-3 flex h-36 w-36 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white/95">
                  <QrCode size={48} className="text-slate-300" />
                </div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Scan for Scratchpad</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button className="text-xs font-bold uppercase tracking-wider text-slate-200 transition-colors hover:text-white">
            View Rules
          </button>
          <div className="mx-1 h-6 w-px bg-white/20" />
          <button className="flex items-center gap-2 rounded-xl border border-red-600 bg-gradient-to-r from-rose-500 to-red-600 px-6 py-2.5 text-sm font-bold text-white transition-all hover:shadow-lg hover:shadow-red-500/30">
            <CheckCircle size={16} /> Submit Exam
          </button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 overflow-hidden">
        <div ref={layoutRef} className="flex min-h-0 flex-1">
          <section className="relative min-h-0 overflow-hidden bg-white" style={{ width: `${leftPaneWidth}%` }}>
            <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 to-indigo-500" />

            <div className="flex items-start justify-between border-b border-slate-100 bg-white px-8 py-6">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-indigo-700">Hands-On 3</span>
                <span className="rounded-md bg-rose-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-rose-700">Difficulty: Hard</span>
              </div>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">Contiguous Zero-Weight Override</h2>
            </div>
            <button type="button" className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 shadow-sm hover:bg-slate-50" aria-label="Maximize pane">
              <Maximize2 size={16} />
            </button>
            </div>

            <div className="relative h-[calc(100%-94px)] overflow-y-auto p-8 text-[15px] leading-relaxed text-slate-700">
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center select-none">
              <div className="-rotate-45 whitespace-nowrap text-6xl font-black tracking-widest text-slate-900/[0.03]">
                DIVYANSH_RNSIT
              </div>
            </div>

            <p className="mb-5 text-slate-600">
              You are given a directed weighted graph with <strong className="rounded bg-slate-100 px-1.5 text-slate-900">N</strong> nodes and <strong className="rounded bg-slate-100 px-1.5 text-slate-900">M</strong> edges. You start from node 0 and must reach node N-1 with minimum possible travel cost.
            </p>
            <p className="mb-5 text-slate-600">
              During traversal, you may use a single <span className="font-semibold text-indigo-600">override ability</span> on any one contiguous segment of your chosen route. Every edge inside that segment becomes <strong className="text-slate-900">zero weight</strong>, but edges before and after the segment retain their original weights.
            </p>
            <p className="mb-5 text-slate-600">
              Compute the least possible total weight from source to destination under this rule. If no valid path exists from node 0 to node N-1, return -1.
            </p>
            <p className="mb-8 text-slate-600">
              Use <strong className="text-slate-900">Dijkstra with state layering</strong> where each node tracks normal movement, in-override movement, and post-override movement. The special override must be contiguous and can be started at any edge.
            </p>

            <div className="mb-6">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-900">
                <LayoutTemplate size={14} className="text-indigo-500" /> Input Format
              </h3>
              <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-[#0f172a] p-5 font-mono text-[13px] leading-loose text-indigo-200 shadow-inner">
                <div className="absolute left-0 top-0 h-full w-1 bg-indigo-500" />
                <span className="text-slate-400">Line 1:</span> Two integers N and M representing nodes and edges.
                <br />
                <span className="text-slate-400">Next M lines:</span> Three integers u, v, w denoting a directed edge from u to v with weight w.
                <br />
                <span className="text-slate-400">Output:</span> One integer, the minimum achievable path cost.
              </div>
            </div>

            <div className="rounded-xl border border-amber-200/60 bg-amber-50 p-4 text-sm text-amber-800">
              <strong className="mb-1 block font-bold">Optimization Note</strong>
              Constraints are tuned for optimized shortest-path logic. Think in layered states to represent before-override, in-override, and after-override transitions.
            </div>
            </div>
          </section>

          <div
            onMouseDown={startVerticalDrag}
            className="w-1 shrink-0 cursor-col-resize bg-slate-700 transition-colors hover:bg-indigo-500"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize question and IDE panes"
          />

          <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#0f172a]">
            <div ref={rightStackRef} className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="min-h-0 overflow-hidden" style={{ height: `${editorHeight}%` }}>
                <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-700/50 bg-[#1e293b] px-6 py-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-300">Language</span>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className="cursor-pointer rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white shadow-inner outline-none transition-colors hover:bg-slate-700"
              >
                <option value="python">Python 3.10</option>
                <option value="cpp">C++ 20</option>
                <option value="java">Java 17</option>
              </select>
            </div>

            <div className="flex items-center gap-4 text-sm font-bold text-slate-400">
              <button type="button" onClick={() => setFontSize((size) => Math.max(12, size - 1))} className="transition-colors hover:text-white">
                A-
              </button>
              <button type="button" onClick={() => setFontSize((size) => Math.min(22, size + 1))} className="transition-colors hover:text-white">
                A+
              </button>
              <button type="button" className="transition-colors hover:text-white" aria-label="Refresh editor">
                <RefreshCw size={14} />
              </button>
            </div>
                </div>

                <div className="relative h-[calc(100%-48px)] bg-[#0f172a] pt-4">
            <Editor
              height="100%"
              language={language}
              theme="vs-dark"
              value={code}
              onChange={(nextValue) => setCode(nextValue ?? '')}
              options={{
                minimap: { enabled: false },
                fontSize,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                padding: { top: 0 },
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                lineHeight: 1.6,
                renderLineHighlight: 'all',
                automaticLayout: true,
                lineNumbers: (lineNumber) => String(lineNumber + 10),
                lineNumbersMinChars: 3,
                roundedSelection: false,
                cursorSmoothCaretAnimation: 'on',
              }}
            />
                </div>
              </div>

              <div
                onMouseDown={startHorizontalDrag}
                className="h-1 shrink-0 cursor-row-resize bg-slate-700 transition-colors hover:bg-indigo-500"
                role="separator"
                aria-orientation="horizontal"
                aria-label="Resize editor and console panes"
              />

              <div className="min-h-0 flex-1 overflow-hidden bg-[#0f172a]">
                <div className="flex h-12 shrink-0 items-center border-b border-slate-700/50 bg-[#1e293b] px-4">
                  <button
                    type="button"
                    onClick={() => setActiveTab('output')}
                    className={`mr-2 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${activeTab === 'output' ? 'bg-indigo-600/25 text-indigo-200' : 'text-slate-300 hover:bg-slate-700/60'}`}
                  >
                    Standard Output
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('tests')}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${activeTab === 'tests' ? 'bg-indigo-600/25 text-indigo-200' : 'text-slate-300 hover:bg-slate-700/60'}`}
                  >
                    Test Cases
                  </button>
                </div>

                <div className="h-[calc(100%-48px)] overflow-hidden">
                  {activeTab === 'output' && (
                    <div className="h-full overflow-y-auto p-4 font-mono text-sm leading-relaxed">
                      <div className="mb-1 text-slate-500">[INFO] Compiling and running against hidden tests...</div>
                      <div className="mb-1 text-emerald-400">✔ Sample Test Case #1 Passed (12ms)</div>
                      <div className="mb-1 text-emerald-400">✔ Sample Test Case #2 Passed (18ms)</div>
                      <div className="mt-2 text-amber-400/80">⚠ Warning: Potential O(N*M) branch detected on line 12. Ensure constraints are met.</div>
                    </div>
                  )}

                  {activeTab === 'tests' && (
                    <div className="h-full overflow-y-auto p-0">
                      <table className="w-full table-fixed border-collapse text-sm text-slate-200">
                        <thead className="sticky top-0 bg-[#1b263b] text-xs uppercase tracking-widest text-slate-300">
                          <tr>
                            <th className="w-12 border-b border-slate-700 px-3 py-3 text-left">#</th>
                            <th className="border-b border-slate-700 px-3 py-3 text-left">Input</th>
                            <th className="w-40 border-b border-slate-700 px-3 py-3 text-left">Expected Output</th>
                            <th className="w-28 border-b border-slate-700 px-3 py-3 text-left">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {testCases.map((item, index) => {
                            const passed = item.status === 'Passed';
                            return (
                              <tr key={`${item.input}-${index}`} className="odd:bg-[#0f172a] even:bg-[#111f35]">
                                <td className="border-b border-slate-800 px-3 py-3 text-slate-400">{index + 1}</td>
                                <td className="border-b border-slate-800 px-3 py-3 font-mono text-xs text-slate-300">{item.input}</td>
                                <td className="border-b border-slate-800 px-3 py-3 font-semibold text-slate-100">{item.expected}</td>
                                <td className="border-b border-slate-800 px-3 py-3">
                                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${passed ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
                                    {passed ? <CheckCircle size={12} /> : <CircleAlert size={12} />}
                                    {item.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex h-16 shrink-0 items-center justify-between border-t border-slate-700/50 bg-[#1e293b] px-6">
              <button className="ml-auto flex items-center gap-2 rounded-lg bg-blue-600 px-8 py-2.5 text-sm font-bold text-white transition-all hover:bg-blue-500" type="button">
                <Play size={14} fill="currentColor" /> Run Code
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
