import React, { useState } from 'react';
import { loginWithEmail } from '../services/auth';

export default function Login({ onLoginSuccess, showToast }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const { user, role } = await loginWithEmail(email, password);
            showToast(`Selamat datang! Masuk sebagai ${role.toUpperCase()}.`, "🎉");
            onLoginSuccess(user, role);
        } catch (error) {
            showToast(error.message, "⚠️");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-wrapper min-h-screen flex items-center justify-center p-4 font-body text-text relative overflow-hidden bg-bg-base">
            {/* Background Polka Dots are drawn globally via body, add decorative retro floating badges */}
            <div className="absolute top-[12%] left-[8%] bg-yellow border-[2.5px] border-text rounded-lg px-3.5 py-1.5 font-tag text-xs font-black uppercase shadow-[3px_3px_0px_#171717] -rotate-6 hidden sm:block">
                ★ KANVAHATI
            </div>
            <div className="absolute top-[18%] right-[10%] bg-blue text-text border-[2.5px] border-text rounded-lg px-3 py-1 font-tag text-xs font-black uppercase shadow-[3px_3px_0px_#171717] rotate-3 hidden sm:block">
                #CUTIEFUL
            </div>
            <div className="absolute bottom-[14%] right-[8%] bg-pink text-text border-[2.5px] border-text rounded-lg px-3.5 py-1.5 font-tag text-xs font-black uppercase shadow-[3px_3px_0px_#171717] rotate-6 hidden sm:block">
                #TRUE POS
            </div>
            <div className="absolute bottom-[16%] left-[10%] bg-white text-text border-[2.5px] border-text rounded-lg px-3 py-1 font-tag text-xs font-black uppercase shadow-[3px_3px_0px_#171717] -rotate-3 hidden sm:block">
                ✦ LIVE SKETCH
            </div>
            
            {/* Login Card (Retro OS Window) */}
            <div className="login-card w-full max-w-[420px] bg-white border-[3px] border-text rounded-2xl shadow-pop overflow-hidden relative animate-[ticketSlide_0.4s_cubic-bezier(0.175,0.885,0.32,1.15)_forwards]">
                {/* Washi tape decoration */}
                <div className="tape-strip"></div>

                {/* Retro Window Header */}
                <div className="retro-window-header bg-blue border-b-[2.5px] border-text px-3 py-2 flex items-center justify-between">
                    <div className="retro-dots flex items-center gap-1.5">
                        <span className="retro-dot retro-dot-red"></span>
                        <span className="retro-dot retro-dot-yellow"></span>
                        <span className="retro-dot retro-dot-blue"></span>
                        <span className="font-tag text-[10px] font-black uppercase tracking-wider text-text ml-1.5">Terminal Login</span>
                    </div>
                    <span className="text-[10.5px] font-tag font-black uppercase bg-yellow px-2 py-0.5 rounded border border-text shadow-[1px_1px_0px_#171717]">v2.0-PRO</span>
                </div>

                <div className="p-6 md:p-8 flex flex-col">
                {/* Header Logo */}
                <div className="text-center mb-6">
                    <img 
                        src="/kanvahati-logo.png" 
                        alt="Kanvahati Logo" 
                        className="h-14 mx-auto object-contain mb-3 filter drop-shadow-[2px_2px_0px_#181818]"
                    />
                    <h2 className="font-title text-xl text-text leading-tight mb-1 title-stroke">Terminal Kasir</h2>
                    <p className="text-[12px] opacity-75 font-body">Silakan masuk menggunakan akun staf terdaftar.</p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4 font-body">
                    {/* Email Input */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10.5px] font-tag font-extrabold uppercase tracking-wider">Email Akun</label>
                        <div className="relative flex items-center">
                            <i className="fa-solid fa-envelope absolute left-3.5 text-text opacity-70"></i>
                            <input 
                                type="email" 
                                required
                                placeholder="nama@domain.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={isLoading}
                                className="w-full font-body border-2 border-text rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:bg-yellow-light/40 bg-white disabled:opacity-50"
                            />
                        </div>
                    </div>

                    {/* Password Input */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10.5px] font-tag font-extrabold uppercase tracking-wider">Password</label>
                        <div className="relative flex items-center">
                            <i className="fa-solid fa-lock absolute left-3.5 text-text opacity-70"></i>
                            <input 
                                type={showPassword ? "text" : "password"} 
                                required
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={isLoading}
                                className="w-full font-body border-2 border-text rounded-xl py-2.5 pl-10 pr-10 text-sm outline-none focus:bg-yellow-light/40 bg-white disabled:opacity-50"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(prev => !prev)}
                                className="absolute right-3.5 text-text/60 hover:text-text cursor-pointer flex items-center p-0.5"
                                tabIndex="-1"
                            >
                                <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                            </button>
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="btn bg-pink text-text border-[2.5px] border-text rounded-full font-title text-[14px] py-2.5 mt-2 shadow-btn hover:bg-white hover:translate-y-[-2px] active:translate-y-[1px] transition-all cursor-pointer flex items-center justify-center gap-2 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <>
                                <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                                <span>Memverifikasi...</span>
                            </>
                        ) : (
                            <>
                                <span>Masuk ke POS</span> <i className="fa-solid fa-right-to-bracket text-xs"></i>
                            </>
                        )}
                    </button>
                </form>

                {/* Footer Copyright */}
                <div className="text-center text-[10.5px] font-tag font-bold opacity-60 mt-8 border-t border-dashed border-text/20 pt-4 uppercase tracking-wider">
                    Kanvahati POS • Designed for folks
                </div>
                </div>
            </div>
        </div>
    );
}
