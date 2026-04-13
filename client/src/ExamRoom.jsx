import React, { useState, useEffect, useRef } from 'react';
import { LiveKitRoom, useTracks, VideoTrack, useRoomContext } from '@livekit/components-react';
import { Track } from 'livekit-client';
import * as faceapi from 'face-api.js';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';
import QRCode from "react-qr-code";
import CodingTerminal from './CodingTerminal';
import '@livekit/components-styles';

// Enhanced coding questions with LeetCode-style descriptions
const codingQuestions = [
  {
    id: 1,
    title: "1. Two Sum",
    difficulty: "Easy",
    description: "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`. You may assume that each input would have exactly one solution, and you may not use the same element twice.",
    example: "Input: nums = [2,7,11,15], target = 9\nOutput: [0,1]\nExplanation: Because nums[0] + nums[1] == 9, we return [0, 1].",
    type: 'coding',
    testCases: [
      { input: '[2,7,11,15]\n9', expected: '[0,1]' },
      { input: '[3,2,4]\n6', expected: '[1,2]' },
      { input: '[3,3]\n6', expected: '[0,1]' },
    ]
  },
  {
    id: 2,
    title: "2. Valid Palindrome",
    difficulty: "Easy",
    description: "A phrase is a palindrome if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward. Given a string `s`, return true if it is a palindrome, or false otherwise.",
    example: "Input: s = 'A man, a plan, a canal: Panama'\nOutput: true\nExplanation: 'amanaplanacanalpanama' is a palindrome.",
    type: 'coding',
    testCases: [
      { input: 'A man, a plan, a canal: Panama', expected: 'true' },
      { input: '0P', expected: 'false' },
      { input: 'a.', expected: 'true' },
    ]
  },
  {
    id: 3,
    title: "3. String to Integer",
    difficulty: "Medium",
    description: "Implement the `myAtoi(string s)` function, which converts a string to a 32-bit signed integer (similar to C/C++'s `atoi` function). The algorithm is as follows: Read in and ignore any leading whitespace. Check if the next character (if not already at the end of the string) is '-' or '+'. Read in next characters until the next non-digit character or the end of the input is reached. The rest of the string is ignored.",
    example: "Input: s = '42'\nOutput: 42\nInput: s = '-91283472332'\nOutput: -2147483648 (clamped to 32-bit integer)",
    type: 'coding',
    testCases: [
      { input: '42', expected: '42' },
      { input: '   -42', expected: '-42' },
      { input: '4193 with words', expected: '4193' },
    ]
  }
];

const QUESTIONS = [
  {
    type: 'mcq',
    id: 1,
    text: 'What does CPU stand for?',
    options: ['Central Process Unit', 'Central Processing Unit', 'Computer Personal Unit', 'Central Processor Unit'],
  },
  {
    type: 'coding',
    id: 2,
    text: 'Two Sum Problem',
    ...codingQuestions[0],
  },
  {
    type: 'mcq',
    id: 3,
    text: 'Which language is primarily used for React?',
    options: ['Python', 'Java', 'JavaScript', 'C++'],
  },
  {
    type: 'coding',
    id: 4,
    text: 'Valid Palindrome Problem',
    ...codingQuestions[1],
  },
  {
    type: 'coding',
    id: 5,
    text: 'String to Integer Problem',
    ...codingQuestions[2],
  },
];


const EXAM_DURATION_SECONDS = 30 * 60;

function decodeJwtSafe(token) {
  if (!token) return {};
  try {
    const payload = token.split('.')[1];
    if (!payload) return {};
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = decodeURIComponent(
      atob(normalized)
        .split('')
        .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join('')
    );
    return JSON.parse(decoded);
  } catch {
    return {};
  }
}

export default function ExamRoom({ erpToken, examCode, cameraId, micId }) {
  const [livekitToken, setLivekitToken] = useState(null);
  const [error, setError] = useState('');
  const configuredLivekitWsUrl = (import.meta.env.VITE_PUBLIC_LIVEKIT_WS_URL || '').trim();
  const runtimeLivekitWsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/livekit-ws`;
  const livekitServerUrl = configuredLivekitWsUrl || runtimeLivekitWsUrl;
  
  // Fetch Token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const response = await fetch(`/api/v1/join-exam`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: erpToken, exam_code: examCode })
        });
        const rawBody = await response.text();
        let data = {};

        if (rawBody) {
          try {
            data = JSON.parse(rawBody);
          } catch {
            data = { detail: rawBody };
          }
        }

        if (!response.ok) {
          throw new Error(data.detail || data.message || "Failed to join exam");
        }

        if (!data.token) {
          throw new Error("Join response did not include a video token.");
        }

        setLivekitToken(data.token);
      } catch (err) {
        setError(`Connection blocked: ${err.message}`);
      }
    };
    fetchToken();
  }, [erpToken, examCode]);

  if (error) return <div style={styles.errorScreen}>{error}</div>;
  if (!livekitToken) return <div style={styles.loadingScreen}>Establishing Secure Connection...</div>;

  return (
    <LiveKitRoom
      video={{ deviceId: cameraId }}
      audio={{ deviceId: micId }}
      token={livekitToken}
      serverUrl={livekitServerUrl}
      connect={true}
      style={styles.meshBackground}
    >
      <ExamInterface
        erpToken={erpToken}
        examCode={examCode}
        livekitToken={livekitToken}
        livekitServerUrl={livekitServerUrl}
      />
    </LiveKitRoom>
  );
}

// Separate component so we can use LiveKit hooks
function ExamInterface({ erpToken, examCode, livekitToken, livekitServerUrl }) {
  const configuredAppOrigin = (import.meta.env.VITE_PUBLIC_APP_ORIGIN || '').trim().replace(/\/$/, '');
  const configuredLanHost = (import.meta.env.VITE_LAN_IP || '').trim();
  const currentHost = window.location.hostname;
  const isLocalHost = currentHost === 'localhost' || currentHost === '127.0.0.1' || currentHost === '::1';
  const qrHost = configuredLanHost || (isLocalHost ? '' : currentHost);
  const appPort = window.location.port || '5173';
  const appProtocol = window.location.protocol === 'https:' ? 'https' : 'http';
  const wsProtocol = appProtocol === 'https' ? 'wss' : 'ws';

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(1800);
  const [isFinished, setIsFinished] = useState(false);
  const [blockingAnomaly, setBlockingAnomaly] = useState(null);
  const videoElementRef = useRef(null);
  const blockingAnomalyRef = useRef(null);
  const lastAnomalyAlertRef = useRef({ key: '', at: 0 });
  const claims = decodeJwtSafe(erpToken);
  const displayUsn = claims.sub || claims.usn || claims.student_id || 'UNKNOWN';

  const room = useRoomContext(); 
  
  const sendAlert = async (eventMsg, severity = 'warning') => {
    if (!room || room.state !== 'connected') return; 
    
    // Notice we removed 'usn'. The teacher will grab the clean ID from LiveKit directly!
    const payload = JSON.stringify({
      event: eventMsg,
      severity: severity,
      time: new Date().toLocaleTimeString([], { hour12: false })
    });
    
    try {
      await room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
    } catch (e) {}
  };

  const setBlockingState = (nextAnomaly) => {
    blockingAnomalyRef.current = nextAnomaly;
    setBlockingAnomaly(nextAnomaly);
  };

  const raiseBlockingAnomaly = async (nextAnomaly) => {
    const now = Date.now();
    const previous = blockingAnomalyRef.current;
    const shouldNotify = !previous || previous.key !== nextAnomaly.key || now - lastAnomalyAlertRef.current.at > 4000;

    if (shouldNotify) {
      await sendAlert(nextAnomaly.message, nextAnomaly.severity || 'critical');
      lastAnomalyAlertRef.current = { key: nextAnomaly.key, at: now };
    }

    if (!previous || previous.key !== nextAnomaly.key || previous.message !== nextAnomaly.message) {
      setBlockingState(nextAnomaly);
    }
  };

  const clearBlockingAnomaly = () => {
    if (blockingAnomalyRef.current) {
      setBlockingState(null);
    }
  };

  // ==========================================
  // 🛡️ DIAGNOSTIC CORE SECURITY & FACE AI 🛡️
  // ==========================================
  useEffect(() => {
    let aiInterval;
    let lastAlertTime = 0;

    const startAI = async () => {
      try {
        console.log("⏳ [AI] Loading Face Models from /models...");
        await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        console.log("✅ [AI] Models Loaded Successfully!");
      } catch (err) {
        console.error("❌ [AI] CRITICAL ERROR: Could not load models. Are they in the public/models folder?", err);
        return;
      }

      console.log("🤖 [AI] Starting Scanner Loop...");

      aiInterval = setInterval(async () => {
        // 1. Find the video element safely
        let video = videoElementRef.current;
        if (!video) {
          video = document.querySelector('video');
          if (video) {
            console.log("🎥 [AI] Found video element on screen!");
            videoElementRef.current = video;
          } else {
            console.log("⚠️ [AI] Waiting for video element to appear...");
            return;
          }
        }

        // 2. Ensure video is actually playing and has dimensions
        // If readyState is not 4, the video is just a blank box. AI cannot read blank boxes.
        if (video.readyState !== 4 || video.videoWidth === 0) {
          console.log("⏳ [AI] Video found, but waiting for it to fully buffer...");
          return;
        }

        try {
          // 3. Run the Detection (0.1 = Maximum Sensitivity)
          const faces = await faceapi.detectAllFaces(
            video,
            new faceapi.SsdMobilenetv1Options({ minConfidence: 0.1 })
          ).withFaceLandmarks();

          // 🔥 THE GOLDEN LOG: This tells us exactly what the AI sees!
          console.log(`👁️ [AI] Scan complete: ${faces.length} faces detected.`);

          if (faces.length === 0) {
            await raiseBlockingAnomaly({
              key: 'NO_FACE_DETECTED',
              message: 'Anomaly: No face detected. Please come to the screen.',
              severity: 'critical',
            });
            return;
          }

          if (faces.length > 1) {
            await raiseBlockingAnomaly({
              key: 'MULTIPLE_FACES',
              message: `Anomaly: Multiple faces detected (${faces.length}). Only one student is allowed.`,
              severity: 'critical',
            });
            return;
          }

          // EYEBALL / HEAD POSE MATH
          const landmarks = faces[0].landmarks;
          const nose = landmarks.getNose()[3];
          const leftEye = landmarks.getLeftEye()[0];
          const rightEye = landmarks.getRightEye()[3];
          const jawBottom = landmarks.getJawOutline()[8];

          const faceWidth = rightEye.x - leftEye.x;
          const faceHeight = jawBottom.y - leftEye.y;

          const noseXPosition = (nose.x - leftEye.x) / faceWidth;
          if (noseXPosition < 0.15 || noseXPosition > 0.85) {
            await raiseBlockingAnomaly({
              key: 'LOOKING_AWAY',
              message: 'Anomaly: Face is not centered. Please look at the screen.',
              severity: 'warning',
            });
            return;
          }

          const noseYPosition = (nose.y - leftEye.y) / faceHeight;
          if (noseYPosition > 0.75) {
            await raiseBlockingAnomaly({
              key: 'LOOKING_DOWN',
              message: 'Anomaly: Looking down detected. Please look at the screen.',
              severity: 'warning',
            });
            return;
          }

          clearBlockingAnomaly();

        } catch (e) {
          console.error("❌ [AI] Crash during scan:", e);
        }
      }, 2000); // Scans every 2 seconds
    };

    startAI();

    return () => {
      if (aiInterval) clearInterval(aiInterval);
    };
  }, [room]);

  // Timer
  useEffect(() => {
    if (timeLeft <= 0 || isFinished) return;
    const timerId = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timerId);
  }, [timeLeft, isFinished]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const currentQ = QUESTIONS[currentQuestionIndex];
  const appBaseUrl = configuredAppOrigin || (qrHost ? `${appProtocol}://${qrHost}:${appPort}` : '');
  const mobileUrl = appBaseUrl
    ? `${appBaseUrl}/?mode=mobile&token=${livekitToken}&server=${encodeURIComponent(livekitServerUrl || `${wsProtocol}://${qrHost}:${appPort}/livekit-ws`)}`
    : '';

  let qrTargetLabel = 'Set VITE_LAN_IP';
  if (appBaseUrl) {
    try {
      qrTargetLabel = new URL(appBaseUrl).host;
    } catch {
      qrTargetLabel = appBaseUrl;
    }
  }

  return (
    <div style={styles.examContainer}>
      <div style={styles.dynamicHeader}>
        <div>
          <h2 style={{ margin: 0, color: '#0f172a', fontSize: '24px' }}>{examCode} Final Examination</h2>
          <p style={{ margin: '5px 0 0 0', color: '#64748b', fontWeight: 'bold' }}>
            USN: <span style={{color: '#3b82f6'}}>{displayUsn}</span> | Telemetry Active 🟢
          </p>
        </div>
        
        {/* 🔥 MOVED PING BUTTON HERE SO IT IS 100% CLICKABLE 🔥 */}
        <button 
          onClick={() => sendAlert("MANUAL PING FROM STUDENT", "info")}
          style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer', zIndex: 9999, pointerEvents: 'auto' }}
        >
          TEST PING
        </button>

        <div style={styles.timerBadge}>
          <span style={{fontSize: '14px', marginRight: '8px', color: '#64748b'}}>TIME</span>
          <span style={{fontSize: '24px', fontWeight: '900', color: '#ef4444'}}>{formatTime(timeLeft)}</span>
        </div>
      </div>

      <div style={{display: 'flex', gap: '20px', flex: 1}}>
        {/* EXAM CONTENT */}
        <div
          style={{
            ...styles.glassCardMain,
            pointerEvents: blockingAnomaly ? 'none' : 'auto',
            filter: blockingAnomaly ? 'blur(2px) saturate(0.7)' : 'none',
            userSelect: blockingAnomaly ? 'none' : 'auto',
          }}
        >
          {isFinished ? (
             <h2 style={{color: '#10b981'}}>✅ Exam Submitted.</h2>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <p style={{ ...styles.questionText, marginBottom: 0 }}>Q{currentQuestionIndex + 1}: {currentQ.text}</p>
                {currentQ.type === 'coding' && (
                  <span style={{ background: '#3b82f6', color: 'white', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
                    CODING CHALLENGE
                  </span>
                )}
              </div>

              {currentQ.type === 'mcq' ? (
                <div style={styles.optionsList}>
                  {currentQ.options.map((opt, idx) => (
                    <button
                      key={idx}
                      onClick={() => setAnswers({ ...answers, [currentQuestionIndex]: opt })}
                      style={{ ...styles.optionButton, backgroundColor: answers[currentQuestionIndex] === opt ? '#eff6ff' : 'white', borderColor: answers[currentQuestionIndex] === opt ? '#3b82f6' : '#e2e8f0' }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                /* SPLIT-PANE CODING ENVIRONMENT (LeetCode-style) */
                <div style={styles.splitPaneContainer}>
                  {/* LEFT SIDE: Problem Description */}
                  <div style={styles.problemPanel}>
                    <div style={styles.problemHeader}>
                      <h2 style={styles.problemTitle}>{currentQ.title}</h2>
                      <span style={{
                        ...styles.difficultyBadge,
                        backgroundColor: currentQ.difficulty === 'Easy' ? '#dcfce7' : currentQ.difficulty === 'Medium' ? '#fef3c7' : '#fee2e2',
                        color: currentQ.difficulty === 'Easy' ? '#166534' : currentQ.difficulty === 'Medium' ? '#92400e' : '#991b1b',
                      }}>
                        {currentQ.difficulty}
                      </span>
                    </div>
                    <div style={styles.problemDescription}>
                      <p>{currentQ.description}</p>
                    </div>
                    <h3 style={styles.exampleLabel}>Example</h3>
                    <div style={styles.exampleCode}>
                      {currentQ.example.split('\n').map((line, idx) => (
                        <div key={idx}>{line}</div>
                      ))}
                    </div>
                  </div>
                  
                  {/* RIGHT SIDE: Monaco Editor & Judge0 */}
                  <div style={styles.editorPanel}>
                    <CodingTerminal
                      question={currentQ}
                      isLocked={Boolean(blockingAnomaly)}
                      lockMessage={blockingAnomaly?.message || ''}
                      onPassAll={() => setAnswers({ ...answers, [currentQuestionIndex]: 'ALL_TESTS_PASSED' })}
                    />
                  </div>
                </div>
              )}
              <div style={styles.navigation}>
                <button style={styles.navBtnLight} onClick={() => setCurrentQuestionIndex(p => Math.max(0, p-1))}>Previous</button>
                <button style={styles.navBtnPrimary} onClick={() => currentQuestionIndex === QUESTIONS.length - 1 ? setIsFinished(true) : setCurrentQuestionIndex(p => p+1)}>
                  {currentQuestionIndex === QUESTIONS.length - 1 ? "Submit Exam" : "Next"}
                </button>
              </div>
            </>
          )}
        </div>

        {/* PROCTOR SIDEBAR */}
        <div style={styles.sidebarLight}>
          <div style={styles.glassSidebarCard}>
            <div style={{color: '#ef4444', fontWeight: 'bold', fontSize: '12px', textAlign: 'center', marginBottom: '10px'}}>🔴 AI MONITORING</div>
            <div style={{ borderRadius: '12px', overflow: 'hidden' }}>
              <MyLocalCamera /> 
            </div>
          </div>
          <div style={styles.glassSidebarCard}>
            <h4 style={{margin: '0 0 10px 0', fontSize: '14px'}}>📱 Desk Cam</h4>
            <div style={{ color: '#334155', fontSize: '12px', marginBottom: '10px' }}>
              QR target: {qrTargetLabel}
            </div>
            <div style={{ background: 'white', padding: '10px', borderRadius: '12px', display: 'flex', justifyContent: 'center' }}>
              <QRCode value={mobileUrl || 'https://localhost:5173'} size={120} />
            </div>
          </div>
        </div>
      </div>

      {blockingAnomaly && (
        <div style={styles.anomalyOverlay}>
          <div style={styles.anomalyCard}>
            <div style={styles.anomalyPill}>AI MONITORING ACTIVE</div>
            <h2 style={styles.anomalyTitle}>{blockingAnomaly.message}</h2>
            <p style={styles.anomalyBody}>
              Your exam timer is still running. Fix the anomaly to regain control of the screen.
            </p>
            <div style={styles.anomalyFooter}>
              <div style={styles.anomalyTimerLabel}>Timer continues</div>
              <div style={styles.anomalyTimerValue}>{formatTime(timeLeft)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MyLocalCamera() {
  const tracks = useTracks([Track.Source.Camera]);
  if (tracks.length === 0) return <div>Starting...</div>;
  return <VideoTrack trackRef={tracks[0]} style={{ width: '100%', transform: 'scaleX(-1)', display: 'block' }} />;
}

const styles = {
  loadingScreen: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', color: '#334155', fontSize: '20px' },
  errorScreen: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fee2e2', color: '#991b1b', fontSize: '20px' },
  meshBackground: { height: '100vh', display: 'flex', backgroundColor: '#fdfbfb', backgroundImage: `radial-gradient(at 0% 0%, hsla(213, 100%, 93%, 1) 0px, transparent 50%), radial-gradient(at 100% 0%, hsla(259, 100%, 95%, 1) 0px, transparent 50%)`, fontFamily: 'system-ui, sans-serif' },
  examContainer: { flex: 1, padding: '40px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' },
  dynamicHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 255, 255, 0.6)', backdropFilter: 'blur(12px)', padding: '20px 30px', borderRadius: '16px', border: '1px solid white' },
  timerBadge: { display: 'flex', alignItems: 'center', background: '#fee2e2', padding: '10px 20px', borderRadius: '12px', border: '1px solid #fecaca' },
  glassCardMain: { flex: 1, background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(16px)', padding: '40px', borderRadius: '20px', border: '1px solid white' },
  questionText: { fontSize: '22px', fontWeight: '600', color: '#0f172a', marginBottom: '30px' },
  optionsList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  optionButton: { padding: '20px', fontSize: '17px', borderRadius: '12px', cursor: 'pointer', textAlign: 'left', fontWeight: '500', border: '2px solid', color: '#0f172a' },
  navigation: { display: 'flex', justifyContent: 'space-between', marginTop: '40px' },
  navBtnLight: { background: 'white', color: '#475569', padding: '15px 30px', borderRadius: '12px', border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: 'bold' },
  navBtnPrimary: { background: '#3b82f6', color: 'white', padding: '15px 30px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 'bold' },
  sidebarLight: { width: '280px', display: 'flex', flexDirection: 'column', gap: '15px' },
  glassSidebarCard: { background: 'rgba(255, 255, 255, 0.7)', borderRadius: '16px', padding: '20px', border: '1px solid white', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' },
  anomalyOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    background: 'rgba(2, 6, 23, 0.72)',
    backdropFilter: 'blur(10px)',
  },
  anomalyCard: {
    width: 'min(680px, 100%)',
    borderRadius: '24px',
    padding: '28px',
    background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.96))',
    border: '1px solid rgba(248, 113, 113, 0.35)',
    boxShadow: '0 30px 90px rgba(0,0,0,0.45)',
    color: '#f8fafc',
    textAlign: 'center',
  },
  anomalyPill: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px 12px',
    borderRadius: '999px',
    background: 'rgba(248, 113, 113, 0.16)',
    color: '#fecaca',
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: '16px',
  },
  anomalyTitle: {
    margin: '0 0 12px 0',
    fontSize: '28px',
    lineHeight: 1.2,
    fontWeight: 900,
    color: '#fff',
  },
  anomalyBody: {
    margin: '0 auto 20px auto',
    maxWidth: '520px',
    fontSize: '16px',
    lineHeight: 1.7,
    color: '#cbd5e1',
  },
  anomalyFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '14px',
    paddingTop: '8px',
  },
  anomalyTimerLabel: {
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#94a3b8',
  },
  anomalyTimerValue: {
    minWidth: '96px',
    padding: '10px 14px',
    borderRadius: '14px',
    background: 'rgba(15, 23, 42, 0.9)',
    border: '1px solid rgba(148, 163, 184, 0.25)',
    color: '#f8fafc',
    fontSize: '28px',
    fontWeight: 900,
    fontVariantNumeric: 'tabular-nums',
  },
  
  // Split-Pane Coding Environment Styles
  splitPaneContainer: { 
    display: 'flex', 
    width: '100%', 
    height: '75vh', 
    border: '1px solid #cbd5e1', 
    borderRadius: '16px', 
    overflow: 'hidden', 
    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
    backgroundColor: '#ffffff',
    marginBottom: '20px',
  },
  problemPanel: { 
    width: '50%', 
    padding: '30px', 
    overflowY: 'auto', 
    borderRight: '1px solid #e2e8f0', 
    backgroundColor: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  problemHeader: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: '20px',
  },
  problemTitle: { 
    fontSize: '24px', 
    fontWeight: '700', 
    color: '#0f172a', 
    margin: '0',
  },
  difficultyBadge: { 
    padding: '6px 12px', 
    borderRadius: '20px', 
    fontSize: '12px', 
    fontWeight: '600',
  },
  problemDescription: { 
    fontSize: '16px', 
    lineHeight: '1.6', 
    color: '#334155',
  },
  exampleLabel: { 
    fontSize: '13px', 
    fontWeight: '600', 
    color: '#64748b', 
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    margin: '10px 0 8px 0',
  },
  exampleCode: { 
    backgroundColor: '#1e293b', 
    padding: '16px', 
    borderRadius: '8px', 
    fontFamily: 'monospace', 
    fontSize: '13px', 
    color: '#4ade80', 
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)',
  },
  editorPanel: { 
    width: '50%', 
    backgroundColor: '#1e1e1e',
    display: 'flex',
    flexDirection: 'column',
  },
};
