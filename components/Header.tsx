import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';

type AppView = 'ledger' | 'dashboard' | 'audit_trail' | 'insurance_demo' | 'executive_demo' | 'ecosystem_demo' | 'live_demo';

const ShieldCheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-electric-blue">
        <path fillRule="evenodd" d="M12.963 2.286a.75.75 0 00-1.927 0l-7.5 4.25A.75.75 0 003 7.236v9.524a.75.75 0 00.536.707l7.5 4.25a.75.75 0 00.927 0l7.5-4.25a.75.75 0 00.536-.707V7.236a.75.75 0 00-.536-.707l-7.5-4.25zM12 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0112 6zm-1.5 8.25a.75.75 0 01.75-.75h.008a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75h-.008a.75.75 0 01-.75-.75v-.008z" clipRule="evenodd" />
    </svg>
);

interface HeaderProps {
    isLiveMode: boolean;
    setIsLiveMode: (isLive: boolean) => void;
    currentView: AppView;
    setView: (view: AppView) => void;
    currentUser: User;
    users: User[];
    onSwitchUser: (userId: string) => void;
}

const NavButton: React.FC<{ isActive: boolean; onClick: () => void; children: React.ReactNode }> = ({ isActive, onClick, children }) => {
    return (
        <button
            onClick={onClick}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                isActive ? 'text-white bg-slate-700' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
        >
            {children}
        </button>
    );
};

const UserSwitcher: React.FC<{ currentUser: User; users: User[]; onSwitchUser: (userId: string) => void }> = ({ currentUser, users, onSwitchUser }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const roleColors: { [key in User['role']]: string } = {
        Administrator: 'bg-red-500',
        Auditor: 'bg-electric-blue',
        Viewer: 'bg-slate-500',
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button onClick={() => setIsOpen(!isOpen)} className="flex items-center space-x-2 text-left p-2 rounded-lg hover:bg-slate-800 transition-colors">
                <div>
                    <p className="text-sm font-semibold text-slate-100">{currentUser.email}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${roleColors[currentUser.role]}`}></span>
                        {currentUser.role}
                    </p>
                </div>
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}><path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" /></svg>
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-56 origin-top-right bg-slate-900 border border-slate-700 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                    <div className="py-1">
                        {users.map(user => (
                            <button
                                key={user.id}
                                onClick={() => { onSwitchUser(user.id); setIsOpen(false); }}
                                className="w-full text-left flex items-center justify-between px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
                            >
                                <span>{user.email}</span>
                                {currentUser.id === user.id && <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-electric-blue"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.052-.143z" clipRule="evenodd" /></svg>}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const Header: React.FC<HeaderProps> = ({ isLiveMode, setIsLiveMode, currentView, setView, currentUser, users, onSwitchUser }) => {
    return (
        <header className="no-print fixed top-0 left-0 right-0 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-20">
                    <div className="flex items-center space-x-3">
                        <ShieldCheckIcon />
                        <h1 className="text-2xl font-bold text-slate-100 tracking-wider">Proveniq Ledger</h1>
                    </div>

                    <nav className="hidden md:flex items-center space-x-4">
                        <NavButton isActive={currentView === 'ledger'} onClick={() => setView('ledger')}>Ledger</NavButton>
                        <NavButton isActive={currentView === 'dashboard'} onClick={() => setView('dashboard')}>Dashboard</NavButton>
                        <NavButton isActive={currentView === 'audit_trail'} onClick={() => setView('audit_trail')}>Audit Trail</NavButton>
                        <NavButton isActive={currentView === 'live_demo'} onClick={() => setView('live_demo')}>
                            <span className="flex items-center gap-1.5">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                </span>
                                Live Demo
                            </span>
                        </NavButton>
                    </nav>

                    <div className="flex items-center space-x-6">
                        <div className="hidden lg:flex items-center space-x-2">
                             <div className="relative flex items-center justify-center w-4 h-4">
                                <span className="absolute inline-flex h-full w-full rounded-full bg-electric-green opacity-75 animate-pulseStatus"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-electric-green"></span>
                            </div>
                            <span className="text-sm font-medium text-electric-green">All Systems Operational</span>
                        </div>
                        
                        {currentUser.role === 'Administrator' && (
                            <div className="flex items-center space-x-2">
                                <label htmlFor="live-mode-toggle" className="text-sm font-medium text-slate-300">Live Mode</label>
                                <button
                                    role="switch"
                                    aria-checked={isLiveMode}
                                    onClick={() => setIsLiveMode(!isLiveMode)}
                                    className={`${isLiveMode ? 'bg-electric-blue' : 'bg-slate-700'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-electric-blue focus:ring-offset-2 focus:ring-offset-slate-900`}
                                >
                                    <span className={`${isLiveMode ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}/>
                                </button>
                            </div>
                        )}
                        
                        <UserSwitcher currentUser={currentUser} users={users} onSwitchUser={onSwitchUser} />
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;