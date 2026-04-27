import React, { useState, useEffect, useRef } from 'react';
import * as faceapi from '@vladmandic/face-api';
import { warmupFaceModels } from './utils/faceWarmup';

export default function FaceVerifyStep({ studentData, onNext }) {
  const [loadingModels, setLoadingModels] = useState(true);
  const [modelLoadError, setModelLoadError] = useState('');
  const [matchingStatus, setMatchingStatus] = useState('Initializing AI Core...');
  const [isFaceMatched, setIsFaceMatched] = useState(false);
  const [isFullyVerified, setIsFullyVerified] = useState(false);
  const [isLaunchingExam, setIsLaunchingExam] = useState(false);

  const [blinkCount, setBlinkCount] = useState(0);
  const [blinkProgress, setBlinkProgress] = useState(0);
  const [selectedUser, setSelectedUser] = useState(
  (studentData?.erpPhotoUrl || '/student_profile.jpg')
    .replace('http://127.0.0.1:8000', '')
    .replace('http://localhost:8000', '')
);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const erpPhotoRef = useRef(null);
  const detectionIntervalRef = useRef(null);

  const erpDescriptorRef = useRef(null);
  const isEyeClosedRef = useRef(false);
  const lastStateChangeRef = useRef(Date.now());
  const BLINK_COOLDOWN_MS = 250;

  useEffect(() => {
    const loadModels = async () => {
      setLoadingModels(true);
      setModelLoadError('');
      setMatchingStatus('Downloading AI Models...');

      try {
        await warmupFaceModels('/models');
        const ssdOptions = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 });

        // GPU Warmup: Pre-compile WebGL shaders
        setMatchingStatus('Compiling GPU kernels...');
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 320;
          canvas.height = 240;
          const dummyVideo = document.createElement('video');
          dummyVideo.width = 320;
          dummyVideo.height = 240;
          // Trigger warmup detection to compile shaders without blocking indefinitely.
          await Promise.race([
            faceapi.detectSingleFace(dummyVideo, ssdOptions),
            new Promise((resolve) => setTimeout(resolve, 3000)),
          ]);
        } catch {
          // Warmup failure is non-critical
        }

        setMatchingStatus('Models Ready. Starting Camera...');
      } catch (err) {
        console.error('Failed to load AI models:', err);
        setModelLoadError(err.message || 'Unknown model loading failure');
        setMatchingStatus(`Error: Could not load AI models from /models. ${err.message}`);
      } finally {
        setLoadingModels(false);
      }
    };

    loadModels();
  }, []);

  useEffect(() => {
    if (loadingModels || modelLoadError) return;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: studentData?.cameraId ? { exact: studentData.cameraId } : true,
          },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {
            // No-op for runtimes that delay playback until ready.
          });
        }
      } catch (err) {
        console.error('Camera access denied:', err);
        setMatchingStatus('Camera permission denied or not found.');
      }
    };

    startCamera();

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }
    };
  }, [loadingModels, modelLoadError, studentData?.cameraId]);

  useEffect(() => {
    if (loadingModels || modelLoadError || !videoRef.current) return;
    const ssdOptions = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 });

    const waitForImageReady = async (img) => {
      if (!img) {
        throw new Error('ERP image element unavailable');
      }

      if (img.complete && img.naturalWidth > 0) {
        return;
      }

      await new Promise((resolve, reject) => {
        const onLoad = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          reject(new Error('ERP image failed to load'));
        };
        const timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error('ERP image load timed out'));
        }, 8000);

        const cleanup = () => {
          clearTimeout(timeoutId);
          img.removeEventListener('load', onLoad);
          img.removeEventListener('error', onError);
        };

        img.addEventListener('load', onLoad, { once: true });
        img.addEventListener('error', onError, { once: true });
      });
    };

    const drawOverlay = (detection, matchDistance = null) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const displaySize = {
        width: video.videoWidth || video.clientWidth || 220,
        height: video.videoHeight || video.clientHeight || 220,
      };

      faceapi.matchDimensions(canvas, displaySize);
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!detection) {
        return;
      }

      const resizedDetection = faceapi.resizeResults(detection, displaySize);
      faceapi.draw.drawFaceLandmarks(canvas, resizedDetection);

      const isKnown = matchDistance !== null ? matchDistance < 0.45 : isFaceMatched;
      const label = isKnown ? 'Verified Student' : 'Unknown / No Match';
      const boxColor = isKnown ? '#10b981' : '#ef4444';

      new faceapi.draw.DrawBox(resizedDetection.detection.box, {
        label,
        boxColor,
        lineWidth: 3,
      }).draw(canvas);
    };

    const precomputeERPDescriptor = async () => {
      if (!erpPhotoRef.current || erpDescriptorRef.current) return;
      try {
        setMatchingStatus('Preparing identity baseline...');
        await waitForImageReady(erpPhotoRef.current);

        const erpDetection = await faceapi
          .detectSingleFace(
            erpPhotoRef.current,
            ssdOptions
          )
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (erpDetection?.descriptor) {
          erpDescriptorRef.current = erpDetection.descriptor;
        } else {
          setMatchingStatus('Could not find a face in ERP image. Use a clearer photo.');
        }
      } catch (err) {
        console.error('Failed to precompute ERP descriptor:', err);
        setMatchingStatus(`Baseline setup failed: ${err.message}`);
      }
    };

    const runLoop = () => {
      setMatchingStatus('Camera stream active. Running face verification...');

      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }

      detectionIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || !erpPhotoRef.current) return;
        if (videoRef.current.paused || videoRef.current.ended) return;

        try {
          // Gear 1: heavier identity matching (descriptor extraction) only until matched.
          if (!isFaceMatched) {
            setMatchingStatus('Extracting facial features...');
            const detection = await faceapi
              .detectSingleFace(
                videoRef.current,
                ssdOptions
              )
              .withFaceLandmarks()
              .withFaceDescriptor();

            if (!detection) {
              drawOverlay(null);
              setMatchingStatus('No face detected... Please look at the camera.');
              return;
            }

            if (!erpDescriptorRef.current) {
              setMatchingStatus('Could not read ERP photo face.');
              return;
            }

            const dist = faceapi.euclideanDistance(erpDescriptorRef.current, detection.descriptor);
            console.log(`AI Match Score: ${dist.toFixed(3)} (Needs to be under 0.45)`);
            drawOverlay(detection, dist);

            if (dist < 0.45) {
              setIsFaceMatched(true);
              setMatchingStatus(`Identity Verified! (Match Score: ${(1 - dist).toFixed(2)})`);
            } else {
              setMatchingStatus('Face does not match ERP photo. Look straight.');
            }
          } else if (isFaceMatched && !isFullyVerified) {
            // Gear 2: lightweight liveness tracking (no descriptor extraction).
            const lightweightDetection = await faceapi
              .detectSingleFace(
                videoRef.current,
                ssdOptions
              )
              .withFaceLandmarks();

            if (!lightweightDetection) return;
            drawOverlay(lightweightDetection, 0.0);

            const leftEye = lightweightDetection.landmarks.getLeftEye();
            const rightEye = lightweightDetection.landmarks.getRightEye();

            const ear = (getEAR(leftEye) + getEAR(rightEye)) / 2.0;
            const EYE_CLOSED_THRESHOLD = 0.30;
            const now = Date.now();

            if (ear < EYE_CLOSED_THRESHOLD) {
              if (!isEyeClosedRef.current && now - lastStateChangeRef.current > BLINK_COOLDOWN_MS) {
                isEyeClosedRef.current = true;
                lastStateChangeRef.current = now;
              }
            } else if (isEyeClosedRef.current) {
              isEyeClosedRef.current = false;
              lastStateChangeRef.current = now;

              setBlinkCount((prev) => {
                const next = prev + 1;
                setBlinkProgress((next / 3) * 100);

                if (next >= 3) {
                  setIsFullyVerified(true);
                  setMatchingStatus('Liveness Confirmed. Ready for Exam.');
                  if (detectionIntervalRef.current) {
                    clearInterval(detectionIntervalRef.current);
                  }
                }

                return next;
              });
            }
          }
        } catch {
          // Ignore transient frame processing errors.
        }
      }, 200);
    };

    // Precompute ERP descriptor before starting detection loop
    precomputeERPDescriptor().then(() => {
      const video = videoRef.current;
      if (video) {
        video.onplay = runLoop;
        if (video.readyState >= 2 && !video.paused) {
          runLoop();
        }
      }
    });

    const video = videoRef.current;

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      }
      if (video) {
        video.onplay = null;
      }
    };
  }, [loadingModels, modelLoadError, isFaceMatched, isFullyVerified, selectedUser]);

  useEffect(() => {
    erpDescriptorRef.current = null;
    isEyeClosedRef.current = false;
    lastStateChangeRef.current = Date.now();
    setIsFaceMatched(false);
    setIsFullyVerified(false);
    setBlinkCount(0);
    setBlinkProgress(0);
    setMatchingStatus('ERP profile changed. Running face verification...');

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  }, [selectedUser]);

  const forcePass = () => {
    setIsFaceMatched(true);
    setIsFullyVerified(true);
    setBlinkProgress(100);
    setBlinkCount(3);
    setMatchingStatus('Forced Pass (Debug)');
  };

  return (
    <div style={styles.container}>
      {loadingModels ? (
        <div style={styles.loadingContainer}>
          <div className="ai-spinner" />
          <h2 style={{ color: '#0f172a', marginTop: '20px' }}>Initializing Security Core...</h2>
          <style>{`
            .ai-spinner {
              border: 4px solid #cbd5e1;
              border-top: 4px solid #3b82f6;
              border-radius: 50%;
              width: 50px;
              height: 50px;
              animation: spin 1s linear infinite;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      ) : modelLoadError ? (
        <div style={styles.loadingContainer}>
          <h2 style={{ color: '#991b1b', marginTop: '20px', textAlign: 'center' }}>AI models could not be initialized.</h2>
          <p style={{ color: '#475569', maxWidth: '720px', textAlign: 'center', marginTop: '12px', lineHeight: 1.5 }}>
            {modelLoadError}
          </p>
          <p style={{ color: '#64748b', marginTop: '8px' }}>
            Check that <span style={{ fontWeight: '600' }}>/models</span> is being served by the client and contains the detector, landmark, and recognition assets.
          </p>
        </div>
      ) : (
        <div style={styles.glassCard}>
          <h2 style={{ textAlign: 'center', margin: '0 0 20px 0' }}>Identity Verification</h2>
          <div style={styles.demoSwitcher}>
            <select
              value={selectedUser}
              onChange={(e) => {
                setSelectedUser(e.target.value);
                if (erpPhotoRef.current) {
                  erpPhotoRef.current.src = e.target.value
                    .replace('http://127.0.0.1:8000', '')
                    .replace('http://localhost:8000', '');
                  erpDescriptorRef.current = null;
                }
              }}
              style={styles.select}
            >
              <option value={studentData?.erpPhotoUrl || '/student_profile.jpg'}>
                Student: {studentData?.studentName || 'Student'}
              </option>
              <option value="/divyansh.jpg">Admin: Divyansh Rai</option>
            </select>
          </div>

          <div style={styles.comparisonGrid}>
            <div style={styles.box}>
              <h4 style={styles.label}>ERP ID Photo</h4>
              <div style={styles.imageWrapper}>
                <img
                  ref={erpPhotoRef}
                  src={
                    studentData?.erpPhotoUrl
                      ? studentData.erpPhotoUrl
                        .replace('http://127.0.0.1:8000', '')
                        .replace('http://localhost:8000', '')
                      : '/student_profile.jpg'
                  }
                  alt="ERP Profile"
                  onError={(e) => {
                    e.currentTarget.src = '/student_profile.jpg';
                  }}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            </div>

            <div style={styles.box}>
              <h4 style={styles.label}>Live Camera</h4>
              <div style={styles.imageWrapper}>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                />
                <canvas
                  ref={canvasRef}
                  width={220}
                  height={220}
                  style={styles.overlayCanvas}
                />
              </div>
            </div>
          </div>

          <div style={{ ...styles.statusBanner, borderColor: isFaceMatched ? '#10b981' : '#f97316' }}>
            {matchingStatus}
          </div>

          <div style={{ ...styles.testArea, opacity: isFaceMatched ? 1 : 0.4 }}>
            <h3 style={{ margin: '0 0 15px 0' }}>Liveness Check: Blink 3 Times</h3>
            <div style={styles.progressContainer}>
              <div style={{ ...styles.progressBar, width: `${blinkProgress}%` }} />
            </div>
            <p style={{ color: '#334155', fontSize: '15px', fontWeight: 'bold', margin: '10px 0 0 0' }}>
              Blinks: {blinkCount}/3
            </p>
          </div>

          <button
            style={isFullyVerified ? styles.buttonGreen : styles.buttonDisabled}
            onClick={async () => {
              if (!isFullyVerified || isLaunchingExam) return;
              setIsLaunchingExam(true);
              try {
                await onNext();
              } catch (error) {
                setMatchingStatus(`Launch blocked: ${error?.message || String(error)}`);
              } finally {
                setIsLaunchingExam(false);
              }
            }}
            disabled={!isFullyVerified || isLaunchingExam}
          >
            {isLaunchingExam ? 'Opening Exam...' : isFullyVerified ? 'Enter Exam ->' : 'Awaiting AI checks...'}
          </button>

          {!isFullyVerified && (
            <button
              onClick={forcePass}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#334155',
                cursor: 'pointer',
                fontSize: '10px',
                marginTop: '-10px',
              }}
            >
              Skip Verification (Debug)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function getEAR(eye) {
  const vertical1 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
  const vertical2 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
  const horizontal = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);

  if (!horizontal) return 0;
  return (vertical1 + vertical2) / (2.0 * horizontal);
}

const styles = {
  container: {
    height: '100vh',
    width: '100vw',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fdfbfb',
    backgroundImage:
      'radial-gradient(at 0% 0%, hsla(213, 100%, 93%, 1) 0px, transparent 50%), radial-gradient(at 100% 0%, hsla(259, 100%, 95%, 1) 0px, transparent 50%), radial-gradient(at 100% 100%, hsla(339, 100%, 96%, 1) 0px, transparent 50%), radial-gradient(at 0% 100%, hsla(196, 100%, 92%, 1) 0px, transparent 50%)',
    fontFamily: 'Avenir Next, Segoe UI, system-ui, sans-serif',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassCard: {
    background: 'rgba(255, 255, 255, 0.65)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.8)',
    padding: '30px',
    borderRadius: '20px',
    width: '650px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.05)',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    color: '#0f172a',
  },
  demoSwitcher: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '8px',
  },
  select: {
    padding: '8px 12px',
    background: '#1e293b',
    color: '#ffffff',
    borderRadius: '8px',
    border: '1px solid #475569',
    outline: 'none',
    fontWeight: '600',
  },
  comparisonGrid: { display: 'flex', gap: '20px', justifyContent: 'space-between' },
  box: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' },
  label: { color: '#475569', marginBottom: '10px', fontSize: '14px', fontWeight: 'bold' },
  imageWrapper: {
    position: 'relative',
    width: '220px',
    height: '220px',
    borderRadius: '16px',
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
    border: '4px solid white',
    boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
  },
  overlayCanvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    transform: 'scaleX(-1)',
    pointerEvents: 'none',
    zIndex: 10,
  },
  statusBanner: {
    background: 'rgba(255, 255, 255, 0.8)',
    padding: '12px',
    borderRadius: '10px',
    color: '#334155',
    textAlign: 'center',
    fontSize: '15px',
    fontWeight: '500',
    borderLeft: '4px solid orange',
    boxShadow: '0 2px 5px rgba(0,0,0,0.02)',
  },
  testArea: {
    background: 'rgba(255, 255, 255, 0.5)',
    padding: '20px',
    borderRadius: '12px',
    textAlign: 'center',
    border: '1px solid white',
    transition: 'opacity 0.3s',
  },
  progressContainer: {
    width: '100%',
    height: '14px',
    background: '#e2e8f0',
    borderRadius: '7px',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    background: '#3b82f6',
    transition: 'width 0.3s ease',
  },
  buttonGreen: {
    background: '#10b981',
    color: 'white',
    padding: '16px',
    borderRadius: '12px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 'bold',
    width: '100%',
    fontSize: '16px',
    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
  },
  buttonDisabled: {
    background: '#cbd5e1',
    color: '#64748b',
    padding: '16px',
    borderRadius: '12px',
    border: 'none',
    width: '100%',
    fontSize: '16px',
  },
};
