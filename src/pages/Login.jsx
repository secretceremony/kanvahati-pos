import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

export default function Login({ onLoginSuccess, showToast }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            await signInWithEmailAndPassword(auth, email.trim(), password);
            showToast("Selamat datang kembali! Login berhasil.", "🎉");
            onLoginSuccess();
        } catch (error) {
            let message = "Email atau password salah!";
            if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
                message = "Email atau password salah!";
            } else if (error.code === 'auth/too-many-requests') {
                message = "Terlalu banyak percobaan. Coba lagi nanti.";
            } else if (error.code === 'auth/network-request-failed') {
                message = "Koneksi gagal. Periksa internet Anda.";
            }
            showToast(message, "⚠️");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-wrapper min-h-screen flex items-center justify-center bg-blue-light/20 p-4 font-body text-text relative overflow-hidden">
            {/* Background decorative elements */}
            <div className="absolute top-[10%] left-[5%] w-12 h-12 rounded-full border-4 border-text bg-pink/30 -z-10 animate-bounce"></div>
            <div className="absolute bottom-[10%] right-[5%] w-16 h-16 rounded-xl border-4 border-text bg-yellow/20 -z-10 rotate-12"></div>
            
            {/* Login Card */}
            <div className="login-card w-full max-w-[400px] bg-white border-[3px] border-text rounded-2xl shadow-[8px_8px_0px_#32628f] overflow-hidden relative p-6 md:p-8 animate-[ticketSlide_0.4s_cubic-bezier(0.175,0.885,0.32,1.15)_forwards]">
                {/* Washi Tape Accent */}
                <div className="washi-tape tape-yellow-1 absolute top-[-10px] left-1/2 transform translate-x-[-50%] rotate-[-2deg] h-6 w-28 bg-pink-light border-l border-r border-dashed border-text/25"></div>
                
                {/* Header Logo */}
                <div className="text-center mt-3 mb-6">
                    <img 
                        src="/kanvahati-logo.png" 
                        alt="Kanvahati Logo" 
                        className="h-12 mx-auto object-contain mb-3"
                    />
                    <h2 className="font-title text-xl text-text leading-tight mb-1">Terminal Kasir</h2>
                    <p className="text-[12px] opacity-75">Silakan masuk menggunakan akun kasir terdaftar.</p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4.5">
                    {/* Email Input */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider">Email Akun</label>
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
                        <label className="text-[11px] font-bold uppercase tracking-wider">Password</label>
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
                            >
                                <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                            </button>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button 
                        type="submit"
                        disabled={isLoading}
                        className="btn bg-pink text-text border-[3px] border-text rounded-full font-title text-[14px] py-3 mt-2 shadow-btn hover:bg-white hover:translate-y-[-3px] hover:shadow-[5px_5px_0px_#32628f] active:translate-y-[1px] active:shadow-[2px_2px_0px_#32628f] transition-all cursor-pointer flex items-center justify-center gap-2 font-bold disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-btn disabled:hover:bg-pink"
                    >
                        {isLoading ? (
                            <>
                                <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                                <span>Memproses...</span>
                            </>
                        ) : (
                            <>
                                <span>Masuk ke POS</span> <i className="fa-solid fa-right-to-bracket text-xs"></i>
                            </>
                        )}
                    </button>
                </form>

                {/* Footer Copyright */}
                <div className="text-center text-[10px] opacity-60 mt-8 border-t border-text/10 pt-4 font-semibold">
                    Kanvahati POS • Designed for folks
                </div>
            </div>
        </div>
    );
}
