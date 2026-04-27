import React, { useEffect, useState } from 'react';
import './App.css';
import { warmupFaceModels } from './utils/faceWarmup';

export default function LoginScreen({ onJoin }) {
  const [examCode, setExamCode] = useState('CS101');
  const [erpToken, setErpToken] = useState('');

  const [cameras, setCameras] = useState([]);
  const [mics, setMics] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [selectedMic, setSelectedMic] = useState('');
  const [statusText, setStatusText] = useState('Loading devices...');
  const [isPreflighting, setIsPreflighting] = useState(false);

  useEffect(() => {
    const preloadAIModels = async () => {
      try {
        await warmupFaceModels('/models');
      } catch (err) {
        console.warn('AI model preload setup failed, fallback will load later.', err);
      }
    };

    preloadAIModels();
  }, []);

  const launchSecureExam = async () => {
    const isTauri = typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;
    if (!isTauri) {
      return;
    }

    const [{ invoke }, { getCurrentWindow }] = await Promise.all([
      import('@tauri-apps/api/core'),
      import('@tauri-apps/api/window'),
    ]);

    await invoke('kill_prohibited_apps');
    await invoke('enforce_lockdown');

    try {
      const appWindow = getCurrentWindow();
      await appWindow.setFocus();
    } catch (e) {
      console.warn('Window focus warning:', e);
    }
  };

  useEffect(() => {
    if (!navigator.mediaDevices) {
      setStatusText('Media devices are not supported in this browser.');
      return;
    }

    const fetchDevices = async () => {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();

        const videoInputs = devices.filter((device) => device.kind === 'videoinput');
        const audioInputs = devices.filter((device) => device.kind === 'audioinput');

        setCameras(videoInputs);
        setMics(audioInputs);

        if (videoInputs.length > 0) {
          setSelectedCamera(videoInputs[0].deviceId);
        }

        if (audioInputs.length > 0) {
          setSelectedMic(audioInputs[0].deviceId);
        }

        setStatusText('');
      } catch (err) {
        console.error('Permission denied:', err);
        setStatusText('Please allow camera and mic permissions in your browser or desktop app.');
      } finally {
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
      }
    };

    fetchDevices();

  }, []);

  const handleStart = async (e) => {
    e.preventDefault();

    if (!examCode || !erpToken) {
      alert('Please enter your credentials.');
      return;
    }

    setIsPreflighting(true);

    try {
      const response = await fetch('/api/v1/preflight-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ erp_jwt_token: erpToken }),
      });

      // changed the existing code base from here 🙏
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to validate ERP token.');
      }

      // ── Fetch exam_id from ERP using exam_code ──────────────────────────
      const resolvedExamCode = data.exam_code || examCode;
      const examRes = await fetch(
        `http://localhost:8000/student/exam-by-code/${resolvedExamCode}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${erpToken}`,
          },
        }
      );
      const examData = await examRes.json().catch(() => ({}));
      if (!examRes.ok) {
        throw new Error(examData.detail || 'Could not load exam details.');
      }
      // ────────────────────────────────────────────────────────────────────

      // ────────────────────────────────────────────────────────────────────

      // Auto start-exam so submission row exists before questions load
      const startRes = await fetch('/student/start-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${erpToken}` },
        body: JSON.stringify({ exam_id: examData.exam_id }),
      });
      // 400 means already started — that's fine, continue
      if (!startRes.ok && startRes.status !== 400) {
        const startErr = await startRes.json().catch(() => ({}));
        throw new Error(startErr.detail || 'Failed to start exam');
      }
      

     

      await launchSecureExam();

      console.log('DEBUG sessionData:', {
        examId: examData.exam_id,
        examCode: resolvedExamCode,
        duration: examData.duration_mins,
        studentId: data.student_id,
      });

      onJoin({
        examCode: resolvedExamCode,
        examId: examData.exam_id,        // ← new
        examTitle: examData.title,           // ← new
        durationMins: examData.duration_mins,   // ← new
        totalMarks: examData.total_marks,     // ← new
        erpToken,
        cameraId: selectedCamera,
        micId: selectedMic,
        studentId: data.student_id,
        studentName: data.student_name,
        erpPhotoUrl: data.erp_photo_url,
      });
      // until here i changed the existing codebase because after preflight succeeds, fetch exam_id using the exam_code
    } catch (err) {
      const errorMessage = err?.message || String(err);
      alert('Preflight Error: ' + errorMessage);
      console.error('Preflight failed:', err);
    } finally {
      setIsPreflighting(false);
    }
  };

  return (
    <div className="setup-wizard">
      <div className="wizard-card">
        <h1>ProctorShield Setup</h1>
        <p>Login and select your hardware before security checks.</p>

        {statusText && <p className="device-status">{statusText}</p>}

        <form onSubmit={handleStart}>
          <input
            type="text"
            placeholder="Exam Code"
            value={examCode}
            onChange={(e) => setExamCode(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Paste ERP Token"
            value={erpToken}
            onChange={(e) => setErpToken(e.target.value)}
            required
          />

          <div className="device-section">
            <label htmlFor="camera-select" className="device-label">Select Camera</label>
            <select
              id="camera-select"
              className="device-dropdown"
              value={selectedCamera}
              onChange={(e) => setSelectedCamera(e.target.value)}
            >
              {cameras.length === 0 && <option value="">No camera detected</option>}
              {cameras.map((cam) => (
                <option key={cam.deviceId} value={cam.deviceId}>
                  {cam.label || `Camera ${cam.deviceId.substring(0, 6)}...`}
                </option>
              ))}
            </select>

            <label htmlFor="mic-select" className="device-label">Select Microphone</label>
            <select
              id="mic-select"
              className="device-dropdown"
              value={selectedMic}
              onChange={(e) => setSelectedMic(e.target.value)}
            >
              {mics.length === 0 && <option value="">No microphone detected</option>}
              {mics.map((mic) => (
                <option key={mic.deviceId} value={mic.deviceId}>
                  {mic.label || `Mic ${mic.deviceId.substring(0, 6)}...`}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className="launch-btn">
            {isPreflighting ? 'Validating Profile...' : 'Launch Secure Exam'}
          </button>
        </form>
      </div>
    </div>
  );
}
