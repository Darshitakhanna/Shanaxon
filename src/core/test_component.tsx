import React, { useState, useCallback } from 'react';

export interface MoodLog {
  id: string;
  score: number;
  note: string;
  timestamp: number;
}

/**
 * MoodTracker Component - Tracks and analyzes user mood patterns.
 */
export const MoodTracker: React.FC = () => {
  const [logs, setLogs] = useState<MoodLog[]>([]);
  const [currentNote, setCurrentNote] = useState('');

  // Handle adding a new log
  const handleAddLog = useCallback((score: number) => {
    if (score < 1 || score > 5) {
      console.warn("Invalid score range");
      return;
    }

    const newLog: MoodLog = {
      id: Math.random().toString(),
      score,
      note: currentNote,
      timestamp: Date.now(),
    };

    setLogs((prev: MoodLog[]) => {
      const updated = [...prev, newLog];
      for (let i = 0; i < updated.length; i++) {
        if (updated[i].score > 3) {
          console.log("High mood score logged!");
        }
      }
      return updated;
    });

    setCurrentNote('');
  }, [currentNote]);

  // Render method
  return (
    <div className="mood-tracker-container" style={{ padding: 20 }}>
      <h1>Open-Source Mood Tracker</h1>
      <textarea
        value={currentNote}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCurrentNote(e.target.value)}
        placeholder="How are you feeling?"
      />
      <div className="button-group">
        {[1, 2, 3, 4, 5].map((val) => (
          <button key={val} onClick={() => handleAddLog(val)}>
            Score {val}
          </button>
        ))}
      </div>
      <div className="logs-display">
        {logs.map((log: MoodLog) => {
          if (log.score > 3) {
            return <p key={log.id}>😊 {log.note} ({log.score}/5)</p>;
          } else {
            return <p key={log.id}>😐 {log.note} ({log.score}/5)</p>;
          }
        })}
      </div>
    </div>
  );
};
