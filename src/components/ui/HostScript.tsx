"use client";

import React from "react";
import { Terminal, ShieldAlert, Cpu, AlertTriangle, UserCheck, Flame, Info } from "lucide-react";

export function HostScript() {
  return (
    <div className="w-full max-w-4xl mx-auto mt-16 px-4">
      <div className="rounded-[2.5rem] border border-white/[0.08] bg-[#12121A]/60 backdrop-blur-[30px] p-8 sm:p-12 shadow-2xl relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-[#00F0FF]/10 blur-[80px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 rounded-full bg-[#FF3B5C]/10 blur-[80px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col gap-12">
          {/* Header */}
          <div className="text-center">
            <span className="inline-block px-3 py-1 mb-4 rounded-full border border-[#00F0FF]/30 bg-[#00F0FF]/10 text-[#00F0FF] text-[10px] font-black uppercase tracking-widest">
              Classified Protocol
            </span>
            <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white leading-tight">
              Nothing Sus <br/> <span className="text-zinc-500">Host Script</span>
            </h2>
            <p className="mt-3 text-sm text-zinc-400 font-mono max-w-xl mx-auto">
              Read these instructions carefully before entering the arena. 
              Trust nobody. Watch everyone. Nothing is as SUS as it seems.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Section 1 */}
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-lg font-bold text-white uppercase tracking-wider">
                <Info className="w-5 h-5 text-indigo-400" /> 1. Welcome
              </h3>
              <div className="p-5 rounded-2xl bg-black/40 border border-white/[0.04] space-y-3">
                <p className="text-sm text-zinc-300 leading-relaxed italic">
                  "Alright everyone, welcome to NOTHING SUS! 🔥 Today, you’re not just playing a game—you’re going to have to think, move, cooperate, and most importantly, trust nobody!"
                </p>
                <p className="text-sm text-zinc-400">There are 25 players in the game, and among you are 4 Imposters.</p>
                <p className="text-sm text-zinc-400">Your job as an Engineer is to complete your tasks, respond to sabotages, earn points, and figure out who the Imposters are. If you're an Imposter... blend in, create chaos, and don't get caught.</p>
              </div>
            </div>

            {/* Section 2 */}
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-lg font-bold text-white uppercase tracking-wider">
                <Terminal className="w-5 h-5 text-emerald-400" /> 2. The Rounds
              </h3>
              <div className="p-5 rounded-2xl bg-black/40 border border-white/[0.04] space-y-3">
                <p className="text-sm text-zinc-300 leading-relaxed">
                  There will be 5 rounds in total.
                </p>
                <p className="text-sm text-zinc-400">Rounds 1 to 4 are your qualifying rounds. Your performance and points matter. Then comes Round 5—the Main Round. That's where everything comes down to the final result.</p>
              </div>
            </div>

            {/* Section 3 */}
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-lg font-bold text-[#00F0FF] uppercase tracking-wider">
                <Cpu className="w-5 h-5" /> 3. Engineer Instructions
              </h3>
              <div className="p-5 rounded-2xl bg-[#00F0FF]/5 border border-[#00F0FF]/10 space-y-3">
                <p className="text-sm text-zinc-300 leading-relaxed">
                  Engineers, listen carefully. Each of you will receive 10 randomly selected tasks from a pool of 20 possible tasks.
                </p>
                <p className="text-sm text-zinc-400">Every normal task you successfully complete gives you 1 point.</p>
                <p className="text-sm text-[#00F0FF]/80 font-bold">But don't get too comfortable... when a sabotage happens, you'll have to act FAST.</p>
              </div>
            </div>

            {/* Section 4 */}
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-lg font-bold text-[#FF3B5C] uppercase tracking-wider">
                <ShieldAlert className="w-5 h-5" /> 4. Sabotage Rules
              </h3>
              <div className="p-5 rounded-2xl bg-[#FF3B5C]/5 border border-[#FF3B5C]/10 space-y-3">
                <p className="text-sm text-zinc-300 leading-relaxed">
                  When an Imposter activates a sabotage, your phones will alert you. You will have 5 minutes to repair the sabotage.
                </p>
                <p className="text-sm text-[#FF3B5C]/90 font-bold">Only the FIRST Engineer who successfully fixes that sabotage gets the 2 points!</p>
                <p className="text-sm text-zinc-400">If nobody fixes it within 5 minutes, a 4-minute critical countdown begins. If it reaches zero... THE IMPOSTERS WIN.</p>
              </div>
            </div>

            {/* Section 5 */}
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-lg font-bold text-[#FF3B5C] uppercase tracking-wider">
                <AlertTriangle className="w-5 h-5" /> 5. Imposter Instructions
              </h3>
              <div className="p-5 rounded-2xl bg-red-500/5 border border-red-500/10 space-y-3">
                <p className="text-sm text-zinc-300 leading-relaxed">
                  Imposters, your identity is secret. You will have your own objectives and tasks.
                </p>
                <p className="text-sm text-zinc-400">Your elimination system starts locked. Complete the required objectives, obtain your unlock code, and activate your elimination system.</p>
                <p className="text-sm font-bold text-[#FF3B5C] italic">"The best Imposter is the one nobody suspects."</p>
              </div>
            </div>

            {/* Section 6 */}
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-lg font-bold text-amber-500 uppercase tracking-wider">
                <UserCheck className="w-5 h-5" /> 6. Emergency Meetings
              </h3>
              <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/10 space-y-3">
                <p className="text-sm text-zinc-300 leading-relaxed">
                  Think you've figured out an Imposter? Call an Emergency Meeting.
                </p>
                <p className="text-sm text-zinc-400">Everyone must report to the meeting area. Sabotages and eliminations are paused.</p>
                <p className="text-sm text-zinc-400">Discuss, accuse, defend, and vote. Choose carefully... one wrong vote could change the game.</p>
              </div>
            </div>
          </div>

          {/* Footer Section */}
          <div className="mt-8 pt-8 border-t border-white/[0.08] text-center space-y-4">
            <h3 className="flex justify-center items-center gap-2 text-xl font-black text-white uppercase tracking-wider">
              <Flame className="w-6 h-6 text-orange-500" /> Ready to play?
            </h3>
            <p className="text-sm text-zinc-400 font-mono max-w-xl mx-auto">
              Engineers... ready to find them? Imposters... ready to lie? <br/>
              Login or Sign Up above to get your assignment.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
