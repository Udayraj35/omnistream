import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { ProfilePanel } from './components/ProfilePanel';
import { Studio } from './components/Studio';
import { Menubar } from './components/Menubar';
import { Welcome } from './components/welcome';
import { AddSourceModal } from './components/AddSourceModal';
import { ConnectAccountModal } from './components/ConnectAccountModal';
import { StreamConfigModal } from './components/StreamConfigModal';
import { SourcePropertiesModal } from './components/SourcePropertiesModal';
import { DestinationsView, AccountsView, AnalyticsView, SettingsView, PlaceholderView } from './components/Views';
import { INITIAL_SCENES } from './constants';
import { Account, Scene, StreamState, StreamMetrics, PlatformType, Source } from './types';
import { Modal } from './components/ui/Modal';
import { Button } from './components/ui/Button';
import { io } from 'socket.io-client';

const generateId = () => Math.random().toString(36).substr(2, 9);
const SOCKET_URL = 'http://localhost:3000';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [streamState, setStreamState] = useState<StreamState>(StreamState.IDLE);

  // State
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string>('');
  const [scenes, setScenes] = useState<Scene[]>(INITIAL_SCENES);
  const [activeSceneId, setActiveSceneId] = useState<string>(INITIAL_SCENES[0].id);
  const [isRecording, setIsRecording] = useState(false);

  // Modals
  const [isAddSourceModalOpen, setIsAddSourceModalOpen] = useState(false);
  const [isConnectAccountModalOpen, setIsConnectAccountModalOpen] = useState(false);
  const [isStreamConfigModalOpen, setIsStreamConfigModalOpen] = useState(false);
  const [isAddSceneModalOpen, setIsAddSceneModalOpen] = useState(false);
  const [newSceneName, setNewSceneName] = useState('');
  const [editingSource, setEditingSource] = useState<Source | null>(null);
  const [metrics, setMetrics] = useState<StreamMetrics>({ fps: 60, cpuUsage: 12, bitrate: 0, droppedFrames: 0, viewers: 0, duration: 0 });
  const [authConfigs, setAuthConfigs] = useState<Record<string, boolean>>({});
  const [bitrate, setBitrate] = useState(2000); // Balanced for 720p stability

  const streamSocketRef = useRef<any>(null);
  const currentScene = scenes.find(s => s.id === activeSceneId) || null;
  const activeAccount = accounts.find(a => a.id === activeAccountId) || null;

  useEffect(() => {
    fetch('/api/health').catch(() => console.log('Backend offline'));
    fetch('/api/config/auth-status').then(r => r.json()).then(setAuthConfigs).catch(() => { });
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (isLoggedIn && !streamSocketRef.current) {
      const socket = io(SOCKET_URL);
      streamSocketRef.current = socket;

      socket.on('connect', () => console.log('Streaming socket connected'));
      socket.on('disconnect', () => console.log('Streaming socket disconnected'));
    } else if (!isLoggedIn && streamSocketRef.current) {
      streamSocketRef.current.disconnect();
      streamSocketRef.current = null;
    }
  }, [isLoggedIn]);

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/accounts');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data);
        if (data.length && !activeAccountId) setActiveAccountId(data[0].id);
      }
    } catch (e) { }
  };

  const handleConfirmStartStream = async (selectedAccountIds: string[]) => {
    setStreamState(StreamState.STARTING);
    // Ingest is default for Studio mixing mode
    const mode = 'ingest';

    const destinations = accounts
      .filter(acc => selectedAccountIds.includes(acc.id) && acc.enabled !== false)
      .map(acc => {
        if (!acc.rtmpUrl || !acc.streamKey) return '';
        // Ensure no double slashes and trim trailing colons/whitespace
        const baseUrl = acc.rtmpUrl.replace(/\/+$/, '');
        const key = acc.streamKey.replace(/^[\s/]+|[\s/:]+$/g, '');
        return `${baseUrl}/${key}`;
      })
      .filter(url => url.length > 0); // Filter out accounts without RTMP config

    if (destinations.length === 0) {
      alert("No valid destinations found. Please use Custom RTMP or ensure your accounts have stream keys configured.");
      setStreamState(StreamState.IDLE);
      return;
    }

    try {
      const res = await fetch('/api/stream/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinations, mode, bitrate })
      });
      if (res.ok) {
        // Give backend a moment to initialize FFmpeg before we start sending data
        setTimeout(() => setStreamState(StreamState.LIVE), 500);
      } else {
        setStreamState(StreamState.IDLE);
        alert("Failed to start");
      }
    } catch (e) { setStreamState(StreamState.IDLE); }
  };

  const handleStreamDataAvailable = (data: Blob) => {
    if (streamSocketRef.current) {
      console.log(`Socket sending chunk: ${data.size} bytes`);
      streamSocketRef.current.emit('stream_data', data);
    } else {
      console.warn("Socket not connected, cannot send stream data");
    }
  };

  const handleStreamToggle = () => {
    if (streamState === StreamState.LIVE) {
      fetch('/api/stream/stop', { method: 'POST' });
      setStreamState(StreamState.IDLE);
    } else {
      setIsStreamConfigModalOpen(true);
    }
  };


  const handleRemoveAccount = async (id: string) => {
    if (!confirm("Are you sure you want to remove this account?")) return;
    try {
      const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setAccounts(prev => prev.filter(a => a.id !== id));
        if (activeAccountId === id) setActiveAccountId('');
      }
    } catch (e) { alert("Failed to remove account"); }
  };

  if (!isLoggedIn) return <Welcome onLogin={() => setIsLoggedIn(true)} onSocialLogin={async (p) => {
    const res = await fetch(`/api/auth/${p}/url`);
    const { url } = await res.json();
    window.open(url, '_blank', 'width=600,height=600');
  }} authConfigs={authConfigs} />;

  const renderContent = () => {
    switch (activeTab) {
      case 'settings': return <SettingsView bitrate={bitrate} onBitrateChange={setBitrate} onClose={() => setActiveTab('dashboard')} />;
      case 'accounts': return <AccountsView accounts={accounts} onAddAccount={() => setIsConnectAccountModalOpen(true)} onRemoveAccount={handleRemoveAccount} />;
      case 'multistream': return <DestinationsView
        accounts={accounts}
        onToggleDestination={(id) => setAccounts(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a))}
        onAddDestination={() => setIsConnectAccountModalOpen(true)}
      />;
      case 'analytics': return <AnalyticsView />;
      case 'dashboard':
      case 'scenes':
      case 'sources':
      case 'mixer':
        return null; // Handled by persistent Studio
      default: return <PlaceholderView title={activeTab} />;
    }
  };

  const isStudioTab = ['dashboard', 'scenes', 'sources', 'mixer'].includes(activeTab);

  return (
    <div className="flex flex-col h-screen w-screen bg-black text-white overflow-hidden selection:bg-indigo-500/30">
      <Menubar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Persistent Studio */}
        <div className={`flex-1 flex flex-col ${isStudioTab ? '' : 'hidden'}`}>
          <Studio
            currentScene={currentScene} scenes={scenes} streamState={streamState} metrics={metrics}
            onStreamAction={handleStreamToggle} onStreamDataAvailable={handleStreamDataAvailable}
            onSceneSelect={setActiveSceneId} onAddScene={() => setIsAddSceneModalOpen(true)}
            onRemoveScene={(id) => setScenes(s => s.filter(x => x.id !== id))}
            onRemoveSource={(sid, id) => setScenes(prev => prev.map(s => s.id === sid ? { ...s, sources: s.sources.filter(x => x.id !== id) } : s))}
            onAddSource={(sid) => { if (currentScene) setIsAddSourceModalOpen(true); }}
            onToggleMute={(sid, id) => setScenes(prev => prev.map(s => s.id === sid ? { ...s, sources: s.sources.map(src => src.id === id ? { ...src, config: { ...src.config, muted: !src.config.muted } } : src) } : s))}
            onVolumeChange={(sid, id, volume) => setScenes(prev => prev.map(s => s.id === sid ? { ...s, sources: s.sources.map(src => src.id === id ? { ...src, config: { ...src.config, volume } } : src) } : s))}
            onToggleSourceVisibility={(sid, id) => setScenes(prev => prev.map(s => s.id === sid ? { ...s, sources: s.sources.map(src => src.id === id ? { ...src, visible: !src.visible } : src) } : s))}
            onTogglePlay={(sid, id) => setScenes(prev => prev.map(s => s.id === sid ? { ...s, sources: s.sources.map(src => src.id === id ? { ...src, playing: src.playing === false } : src) } : s))}
            onRecordAction={setIsRecording} isRecording={isRecording} bitrate={bitrate}
          />
        </div>

        {/* Other Views */}
        {!isStudioTab && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {renderContent()}
          </div>
        )}

        <ProfilePanel
          activeAccount={activeAccount} accounts={accounts} streamState={streamState}
          onSwitchAccount={setActiveAccountId} onAddAccount={() => setIsConnectAccountModalOpen(true)}
          onLogout={() => {
            setIsLoggedIn(false);
            setAccounts([]);
            setActiveAccountId('');
            setActiveTab('dashboard');
          }} onSettings={() => setActiveTab('settings')}
        />
      </div>

      {/* Modals */}
      <AddSourceModal isOpen={isAddSourceModalOpen} onClose={() => setIsAddSourceModalOpen(false)} onAdd={(d) => {
        if (currentScene) {
          const newSrc = { ...d, id: generateId(), visible: true, playing: true, config: { ...d.config, muted: false, volume: 100 } };
          setScenes(prev => prev.map(s => s.id === activeSceneId ? { ...s, sources: [newSrc, ...s.sources] } : s));
        }
        setIsAddSourceModalOpen(false);
      }} />
      <ConnectAccountModal isOpen={isConnectAccountModalOpen} onClose={() => setIsConnectAccountModalOpen(false)} onConnect={() => fetchAccounts()} authConfigs={authConfigs} />
      <StreamConfigModal isOpen={isStreamConfigModalOpen} onClose={() => setIsStreamConfigModalOpen(false)} accounts={accounts} onConfirm={handleConfirmStartStream} />
      <SourcePropertiesModal isOpen={!!editingSource} onClose={() => setEditingSource(null)} source={editingSource} onUpdate={(u) => setScenes(prev => prev.map(s => ({ ...s, sources: s.sources.map(src => src.id === u.id ? u : src) })))} />
      <Modal isOpen={isAddSceneModalOpen} onClose={() => setIsAddSceneModalOpen(false)} title="New Scene">
        <div className="space-y-4">
          <input className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white" value={newSceneName} onChange={e => setNewSceneName(e.target.value)} placeholder="Scene Name" />
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setIsAddSceneModalOpen(false)}>Cancel</Button><Button onClick={() => { if (newSceneName.trim()) setScenes([...scenes, { id: generateId(), name: newSceneName, sources: [] }]); setIsAddSceneModalOpen(false); }}>Create</Button></div>
        </div>
      </Modal>
    </div>
  );
}