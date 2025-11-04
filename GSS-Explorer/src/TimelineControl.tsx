import { useState, useEffect } from 'react';

interface TimelineControlProps {
  maxStep: number;
  currentStep: number;
  onStepChange: (step: number) => void;
  isPlaying: boolean;
  onPlayPause: () => void;
}

export function TimelineControl({
  maxStep,
  currentStep,
  onStepChange,
  isPlaying,
  onPlayPause
}: TimelineControlProps) {
  const [playbackSpeed, setPlaybackSpeed] = useState(100);

  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      onStepChange(Math.min(currentStep + 1, maxStep));
    }, 1000 / playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, currentStep, maxStep, playbackSpeed, onStepChange]);

  return (
    <div style={{
      padding: '20px',
      background: '#f5f5f5',
      borderRadius: '8px',
      marginBottom: '20px'
    }}>
      <div style={{ marginBottom: '15px' }}>
        <h3 style={{ margin: '0 0 10px 0' }}>Timeline Control</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={onPlayPause}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              cursor: 'pointer',
              background: isPlaying ? '#e74c3c' : '#2ecc71',
              color: 'white',
              border: 'none',
              borderRadius: '4px'
            }}
          >
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
            Step: {currentStep} / {maxStep}
          </span>
        </div>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <input
          type="range"
          min="0"
          max={maxStep}
          value={currentStep}
          onChange={(e) => onStepChange(Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>

      <div>
        <label style={{ fontSize: '14px', marginRight: '10px' }}>
          Playback Speed: {playbackSpeed}x
        </label>
        <input
          type="range"
          min="1"
          max="200"
          value={playbackSpeed}
          onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
          style={{ width: '200px' }}
        />
      </div>
    </div>
  );
}
