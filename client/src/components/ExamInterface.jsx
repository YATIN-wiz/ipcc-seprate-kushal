import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, QrCode, RefreshCw, CheckCircle, Terminal, Play, LayoutTemplate } from 'lucide-react';
import Editor from '@monaco-editor/react';
import QRCode from 'react-qr-code';
import * as faceapi from '@vladmandic/face-api';

const EXAM_DURATION_SECONDS = 30 * 60;

const QUESTIONS = [
  {
    id: 1,
    title: 'Contiguous Zero-Weight Override',
    difficulty: 'Hard',
    description:
      'You are given a directed weighted graph with N nodes and M edges. You start from node 0 and must reach node N-1 with minimum travel cost. You may use one contiguous override segment to make those edges zero-weight. Return the minimum possible total cost, or -1 if unreachable.',
    inputFormat: [
      'Line 1: N M',
      'Next M lines: u v w (directed edge u -> v with weight w)',
      'Output: minimum cost from 0 to N-1 with one contiguous override segment',
    ],
    starterCode: `def solve(input_str):
    # Parse input and return the answer as a string
    return ""


if __name__ == "__main__":
    import sys
    data = sys.stdin.read()
    print(solve(data))`,
    testCases: [
      { input: '4 4\n0 1 4\n1 2 6\n2 3 3\n0 3 20\n', expected: '0' },
      { input: '5 5\n0 1 8\n1 2 2\n2 4 5\n0 3 7\n3 4 6\n', expected: '0' },
    ],
  },
  {
    id: 2,
    title: 'Two Sum',
    difficulty: 'Easy',
    description:
      'Given an integer array nums and integer target, return indices of two numbers so they add to target. Assume one valid answer and no reuse of same element.',
    inputFormat: ['Line 1: space-separated numbers', 'Line 2: target', 'Output: [i,j] with i < j'],
    starterCode: `def solve(input_str):
    lines = [line.strip() for line in input_str.strip().splitlines() if line.strip()]
    nums = list(map(int, lines[0].split()))
    target = int(lines[1])
    seen = {}
    for i, x in enumerate(nums):
      if (target - x) in seen:
        return f"[{seen[target - x]},{i}]"
      seen[x] = i
    return "[]"


if __name__ == "__main__":
    import sys
    data = sys.stdin.read()
    print(solve(data))`,
    testCases: [
      { input: '2 7 11 15\n9\n', expected: '[0,1]' },
      { input: '3 2 4\n6\n', expected: '[1,2]' },
    ],
  },
  {
    id: 3,
    title: 'Valid Palindrome',
    difficulty: 'Easy',
    description:
      'Given string s, return true if it reads same forward and backward after lowercasing and removing non-alphanumeric characters.',
    inputFormat: ['Line 1: string s', 'Output: true or false'],
    starterCode: `def solve(input_str):
    s = ''.join(ch.lower() for ch in input_str if ch.isalnum())
    return str(s == s[::-1]).lower()


if __name__ == "__main__":
    import sys
    data = sys.stdin.read()
    print(solve(data))`,
    testCases: [
      { input: 'A man, a plan, a canal: Panama\n', expected: 'true' },
      { input: 'race a car\n', expected: 'false' },
    ],
  },
];

export default function ExamInterface({ studentName = 'Divyansh Rai' }) {
  const [showCameraPreview, setShowCameraPreview] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const [language, setLanguage] = useState('python');
  const [activeTab, setActiveTab] = useState('output');
  const [isExecuting, setIsExecuting] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState('[INFO] Waiting for execution...\n');
  const [timeLeft, setTimeLeft] = useState(EXAM_DURATION_SECONDS);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [leftPaneWidth, setLeftPaneWidth] = useState(45);
  const [editorHeight, setEditorHeight] = useState(70);
  const [resultsByQuestionId, setResultsByQuestionId] = useState({});
  const [blockingAnomaly, setBlockingAnomaly] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [codeByQuestionId, setCodeByQuestionId] = useState(() => {
    const initial = {};
    for (const question of QUESTIONS) initial[question.id] = question.starterCode;
    return initial;
  });

  const layoutRef = useRef(null);
  const rightStackRef = useRef(null);
  const dragModeRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const blockingAnomalyRef = useRef(null);
  const lastAnomalyAlertRef = useRef({ key: '', at: 0 });
  const objectScanInFlightRef = useRef(false);
  const lastObjectScanAtRef = useRef(0);
  const lastObjectAnomalyRef = useRef(null);
  const editorRef = useRef(null);

  const currentQuestion = QUESTIONS[currentQuestionIndex];
  const editorCode = codeByQuestionId[currentQuestion.id] || currentQuestion.starterCode;
  const currentResults = resultsByQuestionId[currentQuestion.id] || [];

  const blockClipboardEvent = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const blockKeyboardClipboardShortcuts = (event) => {
    const key = event?.key?.toLowerCase();
    const ctrlOrCmd = event?.ctrlKey || event?.metaKey;
    if (ctrlOrCmd && ['c', 'v', 'x', 'a'].includes(key)) {
      blockClipboardEvent(event);
    }
  };

  const handleEditorMount = (editor) => {
    editorRef.current = editor;

    const domNode = editor.getDomNode();
    if (domNode) {
      domNode.addEventListener('copy', blockClipboardEvent);
      domNode.addEventListener('cut', blockClipboardEvent);
      domNode.addEventListener('paste', blockClipboardEvent);
      domNode.addEventListener('contextmenu', blockClipboardEvent);
    }

    editor.onKeyDown((event) => {
      const key = event?.browserEvent?.key?.toLowerCase();
      const ctrlOrCmd = event?.browserEvent?.ctrlKey || event?.browserEvent?.metaKey;
      if (ctrlOrCmd && ['c', 'v', 'x', 'a'].includes(key)) {
        blockClipboardEvent(event.browserEvent);
      }
    });

    editor.onDidPaste(() => {
      const model = editorRef.current?.getModel();
      if (model) {
        model.setValue(model.getValue());
      }
    });
  };

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timerId = window.setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timerId);
  }, [timeLeft]);

  useEffect(() => {
    let cancelled = false;
    let detectionIntervalId = null;

    const startMonitoring = async () => {
      try {
        setCameraError('');
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        cameraStreamRef.current = stream;
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
          await cameraVideoRef.current.play();
        }
      } catch (error) {
        setCameraError(error?.message || 'Unable to access camera preview.');
      }

      try {
        await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      } catch {
        setBlockingAnomaly({
          key: 'MODEL_LOAD_FAILED',
          message: 'Anomaly: AI monitoring failed to initialize. Please refresh the page.',
          severity: 'critical',
        });
        return;
      }

      detectionIntervalId = window.setInterval(async () => {
        const video = cameraVideoRef.current;
        if (!video || !video.srcObject || video.readyState !== 4 || video.videoWidth === 0) return;

        const raiseAnomaly = (nextAnomaly) => {
          const now = Date.now();
          const previous = blockingAnomalyRef.current;
          const shouldNotify = !previous || previous.key !== nextAnomaly.key || now - lastAnomalyAlertRef.current.at > 4000;
          if (shouldNotify) {
            lastAnomalyAlertRef.current = { key: nextAnomaly.key, at: now };
          }
          if (!previous || previous.key !== nextAnomaly.key || previous.message !== nextAnomaly.message) {
            blockingAnomalyRef.current = nextAnomaly;
            setBlockingAnomaly(nextAnomaly);
          }
        };

        const clearAnomaly = () => {
          if (blockingAnomalyRef.current) {
            blockingAnomalyRef.current = null;
            setBlockingAnomaly(null);
          }
        };

        try {
          const now = Date.now();
          const previousObjectAnomaly = lastObjectAnomalyRef.current;
          if (previousObjectAnomaly && now - previousObjectAnomaly.at < 9000) {
            raiseAnomaly(previousObjectAnomaly);
            return;
          }

          if (!objectScanInFlightRef.current && now - lastObjectScanAtRef.current > 700) {
            objectScanInFlightRef.current = true;
            lastObjectScanAtRef.current = now;

            const canvas = document.createElement('canvas');
            const maxWidth = 1280;
            const scale = video.videoWidth > maxWidth ? (maxWidth / video.videoWidth) : 1;
            canvas.width = Math.max(1, Math.floor(video.videoWidth * scale));
            canvas.height = Math.max(1, Math.floor(video.videoHeight * scale));
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const imageBase64 = canvas.toDataURL('image/jpeg', 0.95);

              try {
                const objectResponse = await fetch('http://localhost:8000/api/v1/proctor/object-scan', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ image_base64: imageBase64 }),
                });

                if (objectResponse.ok) {
                  const objectData = await objectResponse.json();
                  const flagged = Array.isArray(objectData?.flags) ? objectData.flags : [];
                  const strongest = flagged
                    .filter((item) => item?.object === 'cell phone' || item?.object === 'laptop')
                    .sort((a, b) => (b?.confidence || 0) - (a?.confidence || 0))[0];

                  if (strongest) {
                    const message = strongest.object === 'cell phone'
                      ? 'Anomaly: Mobile phone detected. Remove the phone from camera view.'
                      : 'Anomaly: Extra laptop detected. Only one exam device is allowed.';
                    const objectAnomaly = {
                      key: `BANNED_${String(strongest.object).toUpperCase().replace(' ', '_')}`,
                      message,
                      severity: 'critical',
                      at: Date.now(),
                    };
                    lastObjectAnomalyRef.current = objectAnomaly;
                    raiseAnomaly(objectAnomaly);
                    return;
                  }

                  lastObjectAnomalyRef.current = null;
                } else {
                  const errorPayload = await objectResponse.text();
                  console.error('Object scan API error:', objectResponse.status, errorPayload);
                }
              } catch (error) {
                console.error('Object scan failed:', error);
              }
            }

            objectScanInFlightRef.current = false;
          }

          const faces = await faceapi.detectAllFaces(
            video,
            new faceapi.SsdMobilenetv1Options({ minConfidence: 0.1 })
          ).withFaceLandmarks();

          if (faces.length === 0) {
            raiseAnomaly({
              key: 'NO_FACE_DETECTED',
              message: 'Anomaly: No face detected. Please come to the screen.',
              severity: 'critical',
            });
            return;
          }

          if (faces.length > 1) {
            raiseAnomaly({
              key: 'MULTIPLE_FACES',
              message: `Anomaly: Multiple faces detected (${faces.length}). Only one student is allowed.`,
              severity: 'critical',
            });
            return;
          }

          const landmarks = faces[0].landmarks;
          const nose = landmarks.getNose()[3];
          const leftEye = landmarks.getLeftEye()[0];
          const rightEye = landmarks.getRightEye()[3];
          const jawBottom = landmarks.getJawOutline()[8];

          const faceWidth = Math.max(1, rightEye.x - leftEye.x);
          const faceHeight = Math.max(1, jawBottom.y - leftEye.y);

          const noseXPosition = (nose.x - leftEye.x) / faceWidth;
          if (noseXPosition < 0.15 || noseXPosition > 0.85) {
            raiseAnomaly({
              key: 'LOOKING_AWAY',
              message: 'Anomaly: Face is not centered. Please look at the screen.',
              severity: 'warning',
            });
            return;
          }

          const noseYPosition = (nose.y - leftEye.y) / faceHeight;
          if (noseYPosition > 0.75) {
            raiseAnomaly({
              key: 'LOOKING_DOWN',
              message: 'Anomaly: Looking down detected. Please look at the screen.',
              severity: 'warning',
            });
            return;
          }

          clearAnomaly();
        } catch (error) {
          console.error('Face monitoring scan failed:', error);
        } finally {
          objectScanInFlightRef.current = false;
        }
      }, 1400);
    };

    startMonitoring();

    return () => {
      cancelled = true;
      if (detectionIntervalId) window.clearInterval(detectionIntervalId);
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const onMouseMove = (event) => {
      if (!dragModeRef.current || blockingAnomaly) return;

      if (dragModeRef.current === 'vertical' && layoutRef.current) {
        const rect = layoutRef.current.getBoundingClientRect();
        const relativeX = event.clientX - rect.left;
        const minPx = 340;
        const maxPx = rect.width - 520;
        const clamped = Math.max(minPx, Math.min(maxPx, relativeX));
        setLeftPaneWidth((clamped / rect.width) * 100);
      }

      if (dragModeRef.current === 'horizontal' && rightStackRef.current) {
        const rect = rightStackRef.current.getBoundingClientRect();
        const relativeY = event.clientY - rect.top;
        const minPx = 180;
        const maxPx = rect.height - 180;
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
  }, [blockingAnomaly]);

  const formattedTimer = useMemo(() => {
    const minutes = String(Math.floor(timeLeft / 60)).padStart(2, '0');
    const seconds = String(timeLeft % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  }, [timeLeft]);

  const mobileQrValue = useMemo(() => {
    if (typeof window === 'undefined') return 'https://localhost:5173/?mode=mobile';
    return `${window.location.origin}/?mode=mobile`;
  }, []);

  const handleRunCode = async () => {
    if (blockingAnomaly) return;

    setIsExecuting(true);
    setActiveTab('output');
    setConsoleOutput('[INFO] Sending code to secure Judge0 server...\n');

    try {
      const response = await fetch('http://localhost:8000/api/v1/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language,
          code: editorCode,
          question_id: currentQuestion.id,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setConsoleOutput(`[SUCCESS] Execution complete.\n\n=== Output ===\n${data.output || 'No standard output'}`);
      } else {
        const backendError = data?.error || data?.detail || data?.message || 'Server failed to process request.';
        setConsoleOutput(`[ERROR] Compilation or Runtime Error:\n\n${backendError}`);
      }
    } catch {
      setConsoleOutput('[CRITICAL ERROR] Could not connect to the Backend. Is FastAPI running on port 8000?');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleEditorChange = (value) => {
    const nextCode = value ?? '';
    setCodeByQuestionId((prev) => ({
      ...prev,
      [currentQuestion.id]: nextCode,
    }));
  };

  const goToQuestion = (nextIndex) => {
    if (blockingAnomaly) return;
    const bounded = Math.max(0, Math.min(QUESTIONS.length - 1, nextIndex));
    setCurrentQuestionIndex(bounded);
    setActiveTab('tests');
  };

  const handleSubmitExam = () => {
    if (blockingAnomaly) return;
    setConsoleOutput((prev) => `${prev}\n\n[INFO] Exam submitted successfully.`);
  };

  const getDifficultyBadge = (difficulty) => {
    if (difficulty === 'Easy') return 'bg-emerald-50 text-emerald-700';
    if (difficulty === 'Medium') return 'bg-amber-50 text-amber-700';
    return 'bg-rose-50 text-rose-700';
  };

  const startVerticalDrag = () => {
    if (blockingAnomaly) return;
    dragModeRef.current = 'vertical';
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const startHorizontalDrag = () => {
    if (blockingAnomaly) return;
    dragModeRef.current = 'horizontal';
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden bg-[#0f172a] font-sans text-slate-800 selection:bg-indigo-100 selection:text-indigo-900"
      onCopy={blockClipboardEvent}
      onPaste={blockClipboardEvent}
      onCut={blockClipboardEvent}
      onKeyDown={blockKeyboardClipboardShortcuts}
      onContextMenu={blockClipboardEvent}
    >
      <header className="z-20 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-8 py-4">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 text-lg font-bold text-white shadow-lg shadow-blue-600/20">R</div>
            <div className="flex flex-col">
              <h1 className="text-[15px] font-extrabold tracking-tight text-slate-900">RNSIT Proctoring System</h1>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Secure Exam Core v2.0</span>
            </div>
          </div>
          <div className="mx-2 h-6 w-[1px] bg-slate-200" />
          <div className="flex items-center gap-2 rounded-full border border-emerald-200/60 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
            AI Monitored
          </div>
        </div>

        <div className="absolute left-1/2 flex -translate-x-1/2 transform items-center gap-4">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-xs">👤</span>
            {studentName}
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-2 font-mono text-sm font-bold tracking-widest text-white shadow-md">{formattedTimer}</div>

          <div className="relative">
            <button
              onClick={() => setShowCameraPreview((prev) => !prev)}
              className={`rounded-xl border p-2.5 transition-all duration-200 ${showCameraPreview ? 'scale-105 border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'border-slate-200 bg-white text-slate-600 shadow-sm hover:border-slate-300 hover:bg-slate-50'}`}
              title={showCameraPreview ? 'Hide live webcam preview' : 'Show live webcam preview'}
            >
              <Camera size={18} />
            </button>
            <div className={`absolute left-1/2 top-14 z-50 flex h-40 w-56 -translate-x-1/2 transform flex-col items-center justify-center overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/90 text-xs text-slate-400 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl transition-all duration-200 ${showCameraPreview ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'}`}>
                <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 to-transparent" />
                <video ref={cameraVideoRef} autoPlay muted playsInline className="absolute inset-0 h-full w-full object-cover" />
                <div className="relative z-10 rounded bg-black/50 px-2 py-1 text-[11px] font-semibold text-white">
                  {cameraError ? 'Camera unavailable' : 'Live Camera Preview'}
                </div>
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => {
                setShowQR((prev) => !prev);
              }}
              className={`rounded-xl border p-2.5 transition-all duration-200 ${showQR ? 'scale-105 border-slate-800 bg-slate-800 text-white shadow-lg shadow-slate-800/30' : 'border-slate-200 bg-white text-slate-600 shadow-sm hover:border-slate-300 hover:bg-slate-50'}`}
            >
              <QrCode size={18} />
            </button>
            {showQR && (
              <div className="absolute left-1/2 top-14 z-50 flex w-56 -translate-x-1/2 transform flex-col items-center rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.1)] ring-1 ring-slate-900/5 backdrop-blur-xl">
                <div className="mb-3 flex h-36 w-36 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white p-2">
                  <QRCode value={mobileQrValue} size={120} />
                </div>
                <p className="text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">Scan for Scratchpad</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button className="text-xs font-bold uppercase tracking-wider text-slate-500 transition-colors hover:text-slate-800">View Rules</button>
          <div className="mx-1 h-6 w-[1px] bg-slate-200" />
          <button onClick={handleSubmitExam} disabled={Boolean(blockingAnomaly)} className="flex items-center gap-2 rounded-xl border border-red-600 bg-gradient-to-r from-rose-500 to-red-600 px-6 py-2.5 text-sm font-bold text-white transition-all hover:shadow-lg hover:shadow-red-500/30 disabled:cursor-not-allowed disabled:opacity-70">
            <CheckCircle size={16} /> Submit Exam
          </button>
        </div>
      </header>

      <main className="flex min-h-0 w-full flex-1 overflow-hidden">
        <div ref={layoutRef} className="flex min-h-0 flex-1 gap-0">
          <div className="relative flex min-h-0 flex-col overflow-hidden border-r border-slate-200 bg-white" style={{ width: `${leftPaneWidth}%` }}>
            <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 to-indigo-500" />
            <div className="shrink-0 border-b border-slate-100 bg-white px-8 py-6">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-indigo-700">Hands-On 3</span>
                  <span className={`rounded-md px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest ${getDifficultyBadge(currentQuestion.difficulty)}`}>Difficulty: {currentQuestion.difficulty}</span>
                </div>
                <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">{currentQuestion.title}</h2>
              </div>
            </div>

            <div className="relative flex-1 overflow-y-auto p-8 text-[15px] leading-relaxed text-slate-700 scrollbar-thin scrollbar-thumb-slate-200">
              <div className="pointer-events-none absolute inset-0 flex -rotate-45 transform items-center justify-center whitespace-nowrap text-6xl font-black tracking-widest text-slate-900 opacity-[0.02] select-none">DIVYANSH_RNSIT</div>
              <p className="mb-5 text-slate-600">{currentQuestion.description}</p>

              <div className="mb-6">
                <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-900">
                  <LayoutTemplate size={14} className="text-indigo-500" /> Input Format
                </h3>
                <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-[#0f172a] p-5 font-mono text-[13px] leading-loose text-indigo-200 shadow-inner">
                  <div className="absolute left-0 top-0 h-full w-1 bg-indigo-500" />
                  {currentQuestion.inputFormat.map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-amber-200/60 bg-amber-50 p-4 text-sm text-amber-800">
                <strong className="mb-1 block font-bold">Optimization Note:</strong>
                Constraints are tuned for optimized shortest-path logic. Think in layered states to represent before-override, in-override, and after-override transitions.
              </div>

              <div className="mt-6 flex items-center justify-between">
                <button onClick={() => goToQuestion(currentQuestionIndex - 1)} disabled={currentQuestionIndex === 0 || Boolean(blockingAnomaly)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
                <div className="text-sm font-semibold text-slate-500">Question {currentQuestionIndex + 1} / {QUESTIONS.length}</div>
                <button onClick={() => goToQuestion(currentQuestionIndex + 1)} disabled={currentQuestionIndex === QUESTIONS.length - 1 || Boolean(blockingAnomaly)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">Next</button>
              </div>
            </div>
          </div>

          <div onMouseDown={startVerticalDrag} className="w-1 shrink-0 cursor-col-resize bg-slate-300 transition-colors hover:bg-indigo-500" role="separator" aria-orientation="vertical" aria-label="Resize question and IDE panes" />

          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#0f172a]">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-700/50 bg-[#1e293b] px-6 py-3">
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-rose-500/80" />
                <div className="h-3 w-3 rounded-full bg-amber-500/80" />
                <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
                <div className="mx-2 h-4 w-[1px] bg-slate-600" />
                <select value={language} onChange={(e) => setLanguage(e.target.value)} className="cursor-pointer rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white shadow-inner outline-none transition-colors hover:bg-slate-700">
                  <option value="python">Python 3.10</option>
                  <option value="cpp">C++ 20</option>
                  <option value="java">Java 17</option>
                </select>
              </div>

              <div className="flex items-center gap-4 text-sm font-bold text-slate-400">
                <button className="transition-colors hover:text-white">A-</button>
                <button className="transition-colors hover:text-white">A+</button>
                <button className="transition-colors hover:text-white"><RefreshCw size={14} /></button>
              </div>
            </div>

            <div ref={rightStackRef} className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="relative min-h-0 w-full bg-[#0f172a] pt-4" style={{ height: `${editorHeight}%` }}>
                <Editor
                  height="100%"
                  language={language}
                  theme="vs-dark"
                  value={editorCode}
                  onChange={handleEditorChange}
                  onMount={handleEditorMount}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 15,
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    padding: { top: 0 },
                    scrollBeyondLastLine: false,
                    smoothScrolling: true,
                    lineHeight: 1.6,
                    renderLineHighlight: 'all',
                    automaticLayout: true,
                    readOnly: Boolean(blockingAnomaly),
                    domReadOnly: Boolean(blockingAnomaly),
                    contextmenu: false,
                    copyWithSyntaxHighlighting: false,
                  }}
                />
              </div>

              <div onMouseDown={startHorizontalDrag} className="h-2 shrink-0 cursor-row-resize bg-slate-700 transition-colors hover:bg-indigo-500" role="separator" aria-orientation="horizontal" aria-label="Resize editor and console panes" />

              <div className="flex min-h-0 flex-1 flex-col border-t border-slate-700/50 bg-[#1e293b]">
                <div className="flex min-h-0 flex-1 flex-col border-b border-slate-800 bg-[#0f172a] p-0">
                  <div className="flex items-center gap-2 border-b border-slate-700/50 bg-[#1e293b]/50 px-4 py-2">
                    <button onClick={() => setActiveTab('output')} disabled={Boolean(blockingAnomaly)} className={`flex items-center gap-2 rounded-md px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${activeTab === 'output' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'} disabled:cursor-not-allowed disabled:opacity-50`}>
                      <Terminal size={12} /> Standard Output
                    </button>
                    <button onClick={() => setActiveTab('tests')} disabled={Boolean(blockingAnomaly)} className={`rounded-md px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${activeTab === 'tests' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'} disabled:cursor-not-allowed disabled:opacity-50`}>
                      Test Cases
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 font-mono text-sm leading-relaxed">
                    {activeTab === 'output' ? (
                      <pre className={`whitespace-pre-wrap ${consoleOutput.includes('Error') ? 'text-red-400' : 'text-slate-300'}`}>{consoleOutput}</pre>
                    ) : (
                      <div className="w-full">
                        <table className="w-full border-collapse text-left">
                          <thead>
                            <tr className="border-b border-slate-700 text-xs uppercase tracking-wider text-slate-500">
                              <th className="px-3 py-2">#</th>
                              <th className="px-3 py-2">Input</th>
                              <th className="px-3 py-2">Expected</th>
                              <th className="px-3 py-2">Status</th>
                            </tr>
                          </thead>
                          <tbody className="text-[13px] text-slate-300">
                            {currentQuestion.testCases.map((testCase, index) => {
                              const result = currentResults[index];
                              const status = result ? result.status : 'Hidden';
                              const statusColor = status === 'Passed' ? 'text-emerald-400' : status === 'Hidden' ? 'text-slate-400' : 'text-rose-400';

                              return (
                                <tr key={`${currentQuestion.id}-${index}`} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                                  <td className="px-3 py-3">{index + 1}</td>
                                  <td className="px-3 py-3 font-mono">{testCase.input.trim() || '<empty>'}</td>
                                  <td className="px-3 py-3 font-mono">{testCase.expected}</td>
                                  <td className="px-3 py-3"><span className={statusColor}>{status}</span></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex h-16 items-center justify-end bg-[#1e293b] px-6">
                  <button onClick={handleRunCode} disabled={isExecuting || timeLeft <= 0 || Boolean(blockingAnomaly)} className={`flex items-center gap-2 rounded-xl px-8 py-2.5 text-sm font-bold text-white shadow-[0_0_15px_rgba(79,70,229,0.4)] transition-all ${(isExecuting || blockingAnomaly) ? 'cursor-not-allowed bg-indigo-400 opacity-70' : 'bg-indigo-600 hover:-translate-y-0.5 hover:bg-indigo-500'} disabled:cursor-not-allowed disabled:opacity-70`}>
                    <Play size={14} fill="currentColor" /> {blockingAnomaly ? 'Screen Locked' : isExecuting ? 'Executing...' : 'Run Code'}
                  </button>
                  <button onClick={handleSubmitExam} disabled={Boolean(blockingAnomaly)} className="ml-3 flex items-center gap-2 rounded-xl border border-emerald-600 bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-70">
                    <CheckCircle size={14} /> Submit
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {blockingAnomaly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-6 backdrop-blur-md">
          <div className="w-full max-w-2xl rounded-[28px] border border-rose-400/30 bg-slate-900/95 p-8 text-center text-slate-100 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
            <div className="mb-4 inline-flex rounded-full border border-rose-300/25 bg-rose-500/10 px-4 py-1.5 text-xs font-extrabold uppercase tracking-[0.22em] text-rose-200">AI Monitoring Active</div>
            <h2 className="mb-3 text-3xl font-black tracking-tight text-white">{blockingAnomaly.message}</h2>
            <p className="mx-auto max-w-xl text-sm leading-7 text-slate-300">
              Your exam timer is still running. Fix the anomaly shown by the camera, then the screen will unlock automatically.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <div className="rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Timer continues</div>
              <div className="rounded-2xl border border-slate-700 bg-slate-950 px-5 py-3 font-mono text-3xl font-black tracking-widest text-white">{formattedTimer}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}