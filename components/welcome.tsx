import React, { useState } from 'react';
import { MonitorPlay, ArrowRight, CheckCircle, Chrome, Facebook, Twitch, Mail } from 'lucide-react';
import { Button } from './ui/Button';

interface WelcomeProps {
  onLogin: (email?: string, password?: string) => void;
  onSocialLogin: (platform: string) => void;
  authConfigs?: Record<string, boolean>;
}

export const Welcome: React.FC<WelcomeProps> = ({ onLogin, onSocialLogin, authConfigs = {} }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) {
      alert("Please enter both email and password.");
      return;
    }
    // Simple mock validation for now, or just pass it up
    onLogin(email, password);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-indigo-500/30">
      <header className="px-8 py-6 flex justify-between items-center border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <MonitorPlay className="text-white w-6 h-6" />
          </div>
          <span className="font-bold text-xl tracking-tight">StreamForge</span>
        </div>
        <div className="flex gap-4">
          <Button variant="ghost" onClick={() => setIsLogin(true)}>Log In</Button>
          <Button variant="primary" onClick={() => setIsLogin(false)}>Get Started</Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row">
        <div className="flex-1 p-12 flex flex-col justify-center max-w-2xl">
          <h1 className="text-5xl font-extrabold tracking-tight leading-tight mb-6 text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400">
            The Ultimate <br /> Streaming Studio
          </h1>
          <p className="text-xl text-zinc-400 mb-8 leading-relaxed">
            Compose, mix, and broadcast professional live streams from your browser.
            Connect multiple accounts, mix local and remote sources, and stream to YouTube, Twitch, and Facebook simultaneously.
          </p>

          <div className="space-y-4 mb-10">
            {[
              "Multi-platform Simulcasting",
              "Advanced Audio Mixing & Processing",
              "Unlimited Scenes & Sources",
              "Cloud-based Transcoding"
            ].map((item, i) => (
              <div key={i} className="flex items-center text-zinc-300">
                <CheckCircle className="text-indigo-500 mr-3" size={20} />
                {item}
              </div>
            ))}
          </div>

          <Button size="lg" className="w-fit px-8" onClick={() => setIsLogin(true)}>Launch Studio <ArrowRight className="ml-2" /></Button>
        </div>

        <div className="flex-1 bg-zinc-900/50 border-l border-zinc-800 flex items-center justify-center p-12">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
              <p className="text-zinc-500 text-sm">Enter your details to access your studio.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <Button variant="outline" className="w-full flex items-center justify-center gap-2 hover:bg-zinc-800 hover:text-white border-zinc-700 text-zinc-400" onClick={() => authConfigs.google ? onSocialLogin('google') : alert("Google login requires GOOGLE_CLIENT_ID etc. in .env")}>
                <Chrome size={18} /> Google
              </Button>
              <Button variant="outline" className="w-full flex items-center justify-center gap-2 hover:bg-[#1877F2]/10 hover:text-[#1877F2] hover:border-[#1877F2]/50 border-zinc-700 text-zinc-400" onClick={() => authConfigs.facebook ? onSocialLogin('facebook') : alert("Facebook login requires FACEBOOK_CLIENT_ID etc. in .env")}>
                <Facebook size={18} /> Facebook
              </Button>
              <Button variant="outline" className="w-full flex items-center justify-center gap-2 hover:bg-[#9146FF]/10 hover:text-[#9146FF] hover:border-[#9146FF]/50 border-zinc-700 text-zinc-400" onClick={() => authConfigs.twitch ? onSocialLogin('twitch') : alert("Twitch login requires TWITCH_CLIENT_ID etc. in .env")}>
                <Twitch size={18} /> Twitch
              </Button>
              <Button variant="outline" className="w-full flex items-center justify-center gap-2 hover:bg-zinc-800 hover:text-white border-zinc-700 text-zinc-400" onClick={() => setIsLogin(!isLogin)}>
                <Mail size={18} /> Email
              </Button>
            </div>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-zinc-950 px-2 text-zinc-600">Or continue with email</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-medium text-zinc-400 uppercase mb-1.5">Email</label>
                <input
                  id="email"
                  name="email"
                  autoComplete="email"
                  type="email"
                  placeholder="name@example.com"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-600 outline-none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-xs font-medium text-zinc-400 uppercase mb-1.5">Password</label>
                <input
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  type="password"
                  placeholder="••••••••"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-600 outline-none"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button variant="primary" size="lg" className="w-full mt-2" onClick={handleLogin}>
                {isLogin ? 'Sign In' : 'Create Account'}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
