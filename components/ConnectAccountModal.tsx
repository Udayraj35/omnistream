
import React, { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import {
  Youtube,
  Twitch,
  Facebook,
  Instagram,
  Twitter,
  Radio,
  Globe,
  CheckCircle,
  Loader2,
  Lock,
  Smartphone,
  Shield
} from 'lucide-react';
import { PlatformType } from '../types';

interface ConnectAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: () => void;
  authConfigs?: Record<string, boolean>;
}

export const ConnectAccountModal: React.FC<ConnectAccountModalProps> = ({ isOpen, onClose, onConnect, authConfigs = {} }) => {
  const [connectingPlatform, setConnectingPlatform] = useState<PlatformType | null>(null);
  const [showRtmpForm, setShowRtmpForm] = useState(false);
  const [rtmpData, setRtmpData] = useState({ name: '', url: '', key: '' });

  const platforms: { id: PlatformType; name: string; icon: any; color: string; desc: string }[] = [
    { id: 'youtube', name: 'YouTube', icon: Youtube, color: 'text-red-500 bg-red-500/10', desc: 'Stream to Channel & Shorts' },
    { id: 'twitch', name: 'Twitch', icon: Twitch, color: 'text-purple-500 bg-purple-500/10', desc: 'Interactive Live Streaming' },
    { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'text-blue-600 bg-blue-600/10', desc: 'Live Producer & Gaming' },
    { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'text-pink-500 bg-pink-500/10', desc: 'Live Rooms' },
    { id: 'tiktok', name: 'TikTok', icon: Smartphone, color: 'text-teal-400 bg-teal-400/10', desc: 'Mobile Gaming & Live' },
    { id: 'x', name: 'X / Twitter', icon: Twitter, color: 'text-white bg-zinc-800', desc: 'Media Studio Broadcast' },
    { id: 'custom_rtmp', name: 'Custom RTMP', icon: Radio, color: 'text-orange-400 bg-orange-400/10', desc: 'Any RTMP Server' },
  ];

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'AUTH_SUCCESS' && event.data?.account) {
        onConnect();
        setConnectingPlatform(null);
        onClose();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onConnect, onClose]);

  const handlePlatformClick = async (platform: PlatformType) => {
    if (platform === 'custom_rtmp') {
      setShowRtmpForm(true);
      return;
    }

    setConnectingPlatform(platform);

    try {
      const res = await fetch(`/api/auth/${platform}/url`);
      if (res.ok) {
        const { url } = await res.json();
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        window.open(
          url,
          'Connect Account',
          `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,status=yes`
        );
      } else {
        console.error('Failed to get auth URL');
        setConnectingPlatform(null);
      }
    } catch (error) {
      console.error('Error starting auth:', error);
      setConnectingPlatform(null);
    }
  };

  const handleRtmpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'custom_rtmp',
          name: rtmpData.name,
          rtmpUrl: rtmpData.url,
          streamKey: rtmpData.key
        })
      });

      if (res.ok) {
        const account = await res.json();
        onConnect();
        setShowRtmpForm(false);
        setRtmpData({ name: '', url: '', key: '' });
        onClose();
      }
    } catch (e) { console.error("Failed to add account", e); }
  };

  const handleBack = () => {
    setShowRtmpForm(false);
    setConnectingPlatform(null);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Connect Account">
      {connectingPlatform ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
          <div className="text-center">
            <h3 className="text-lg font-medium text-white">Connecting to {platforms.find(p => p.id === connectingPlatform)?.name}...</h3>
            <p className="text-zinc-500 text-sm mt-1">Please authorize access in the popup window.</p>
          </div>
        </div>
      ) : showRtmpForm ? (
        <form onSubmit={handleRtmpSubmit} className="space-y-4">
          <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-lg mb-4 flex items-start">
            <Radio className="text-orange-500 mt-1 mr-3 flex-shrink-0" size={18} />
            <div>
              <h4 className="text-sm font-medium text-orange-400">Custom RTMP Destination</h4>
              <p className="text-xs text-orange-300/70 mt-1">Enter the stream URL and key provided by your streaming platform.</p>
            </div>
          </div>

          <div>
            <label htmlFor="rtmp-name" className="block text-sm font-medium text-zinc-400 mb-1">Destination Name</label>
            <input
              id="rtmp-name"
              name="rtmp-name"
              required
              type="text"
              placeholder="e.g. My Custom Server"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              value={rtmpData.name}
              onChange={e => setRtmpData({ ...rtmpData, name: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="rtmp-url" className="block text-sm font-medium text-zinc-400 mb-1">RTMP URL</label>
            <input
              id="rtmp-url"
              name="rtmp-url"
              required
              type="url"
              placeholder="rtmp://..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono"
              value={rtmpData.url}
              onChange={e => setRtmpData({ ...rtmpData, url: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="rtmp-key" className="block text-sm font-medium text-zinc-400 mb-1">Stream Key</label>
            <div className="relative">
              <input
                id="rtmp-key"
                name="rtmp-key"
                required
                type="password"
                placeholder="••••••••••••"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono pr-10"
                value={rtmpData.key}
                onChange={e => setRtmpData({ ...rtmpData, key: e.target.value })}
              />
              <Lock className="absolute right-3 top-2.5 text-zinc-600" size={14} />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-zinc-800">
            <Button type="button" variant="ghost" onClick={handleBack}>Back</Button>
            <Button type="submit">Add Destination</Button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400 pb-2">Select a platform to connect. This allows you to stream to these destinations and access chat/analytics.</p>
          <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
            {platforms.map(platform => {
              const Icon = platform.icon;
              return (
                <button
                  key={platform.id}
                  onClick={() => {
                    if (platform.id === 'custom_rtmp') {
                      handlePlatformClick(platform.id);
                    } else if (authConfigs[platform.id]) {
                      handlePlatformClick(platform.id);
                    } else {
                      alert(`Real ${platform.name} login requires configuration in .env`);
                    }
                  }}
                  className="flex flex-col items-start p-4 rounded-xl border border-zinc-800 hover:bg-zinc-800/50 hover:border-zinc-700 transition-all text-left group relative overflow-hidden"
                >
                  <div className={`p-2.5 rounded-lg mb-3 ${platform.color} group-hover:scale-110 transition-transform`}>
                    <Icon size={24} />
                  </div>
                  <h4 className="font-semibold text-zinc-100">{platform.name}</h4>
                  <p className="text-[11px] text-zinc-500 mt-1 leading-tight">{platform.desc}</p>
                </button>
              );
            })}
          </div>
          <div className="pt-4 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
            <div className="flex items-center">
              <Shield size={12} className="mr-1.5" />
              Secure OAuth 2.0 Connection
            </div>
            <a href="#" className="hover:text-zinc-300">Privacy Policy</a>
          </div>
        </div>
      )}
    </Modal>
  );
};
