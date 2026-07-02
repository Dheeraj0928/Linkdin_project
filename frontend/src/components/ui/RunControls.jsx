import { useState, useEffect } from 'react';
import { Play, Square, Loader } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';

/**
 * RunControls — Stop and Continue buttons
 *
 * STOP: Kills the current automation process (SIGTERM).
 * CONTINUE (Start): Starts a new automation run.
 *   Because your automation tracks sent_connections.json, it automatically
 *   skips already-messaged profiles and picks up where it left off.
 *   Auto-Enter is handled server-side so the browser closes cleanly.
 */
export default function RunControls({ isRunning, onStatusChange, compact = false }) {
  const [loading, setLoading] = useState(false);
  const [sendEnabled, setSendEnabled] = useState(true);
  const toast = useToast();

  useEffect(() => {
    api.getSettings().then((s) => setSendEnabled(s.SEND_ENABLED === 'true')).catch(() => {});
  }, [isRunning]);

  async function handleStart() {
    if (!sendEnabled) {
      toast('Send Enabled is OFF — messages will only be drafted, not sent. Turn it ON in Configuration.', 'warning');
    }
    setLoading(true);
    try {
      await api.startRun();
      toast('Automation started! Browser will open and begin processing.', 'success');
      onStatusChange?.();
    } catch (err) {
      toast(`Failed to start: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleStop() {
    setLoading(true);
    try {
      await api.stopRun();
      toast('Stop signal sent. Automation will finish the current profile and close.', 'warning');
      onStatusChange?.();
    } catch (err) {
      toast(`Failed to stop: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  if (isRunning) {
    return (
      <button
        className="btn btn-danger"
        onClick={handleStop}
        disabled={loading}
        style={compact ? { padding: '6px 12px', fontSize: 12 } : {}}
        title="Stop the automation. It will finish the current action and close the browser."
      >
        {loading
          ? <Loader size={compact ? 12 : 14} className="animate-spin" />
          : <Square size={compact ? 12 : 14} />
        }
        {compact ? 'Stop' : 'Stop Automation'}
      </button>
    );
  }

  return (
    <button
      className="btn btn-primary"
      onClick={handleStart}
      disabled={loading}
      style={compact ? { padding: '6px 12px', fontSize: 12 } : {}}
      title="Start a new run. Already-messaged profiles are automatically skipped."
    >
      {loading
        ? <Loader size={compact ? 12 : 14} className="animate-spin" />
        : <Play size={compact ? 12 : 14} />
      }
      {compact ? 'Start' : 'Start Automation'}
    </button>
  );
}
