
import React, { useState, useEffect } from 'react';

const icons = {
  link: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 text-electric-blue"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>,
  shield: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 text-electric-blue"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.286zm0 13.036h.008v.008h-.008v-.008z" /></svg>,
  magnifying: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 text-electric-blue"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>,
  exclamation: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 text-electric-blue"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.007H12v-.007z" /></svg>
};

const slides = [
  { icon: 'link', lines: ['Unbreakable Chain', 'of Custody'] },
  { icon: 'shield', lines: ['Absolute Data', 'Integrity'] },
  { icon: 'magnifying', lines: ['Total Audit', 'Transparency'] },
  { icon: 'exclamation', lines: ['Proactive Fraud', 'Protection'] }
];

const features = [
    { icon: 'shield', title: 'Integrity Verification', description: 'Run cryptographic checks to ensure the entire ledger is untampered and sequentially valid.' },
    { icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-8 h-8"><path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201-4.42 5.5 5.5 0 011.663-4.42 5.5 5.5 0 019.201 4.42 5.5 5.5 0 01-1.663 4.42zM12.5 6a.5.5 0 00-1 0v1h-1a.5.5 0 000 1h1v1a.5.5 0 001 0v-1h1a.5.5 0 000-1h-1V6z" clipRule="evenodd" /><path d="M5.105 15.657a.75.75 0 01.037.96 6.5 6.5 0 00-.756 7.627.75.75 0 11-1.25-.783 5 5 0 01.58-5.864.75.75 0 01.961-.037zM14.895 15.657a.75.75 0 00-.037.96 6.5 6.5 0 01.756 7.627.75.75 0 101.25-.783 5 5 0 00-.58-5.864.75.75 0 00-.961-.037z" /></svg>, title: 'AI Audit Assistant', description: 'Ask natural language questions about the ledger and receive instant, data-driven answers from Gemini.' },
    { icon: 'link', title: 'Chain Visualization', description: 'Switch from a grid to an interactive chain view to visualize the cryptographic links between blocks.' },
    { icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-8 h-8"><path d="M3.5 2.75a.75.75 0 00-1.5 0v14.5a.75.75 0 001.5 0v-4.392l1.657-.348a6.44 6.44 0 014.271 .572 7.939 7.939 0 004.271.572 6.44 6.44 0 014.271-.572L19.5 12.608v-4.392a.75.75 0 00-1.5 0v3.24l-1.657.348a6.44 6.44 0 01-4.271-.572 7.939 7.939 0 00-4.271-.572 6.44 6.44 0 01-4.271.572L3.5 11.392V2.75z" /></svg>, title: 'Live Ledger Monitoring', description: 'Enable live mode to watch new claims get added to the ledger in real-time, with full UI updates.' },
    { icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-8 h-8"><path fillRule="evenodd" d="M5 2.75C5 1.784 5.784 1 6.75 1h6.5c.966 0 1.75.784 1.75 1.75v14.5a.75.75 0 01-1.5 0V15.5h-5v1.75a.75.75 0 01-1.5 0V2.75zM12.5 6a.5.5 0 00-1 0v2a.5.5 0 001 0V6zM7.5 6a.5.5 0 011 0v2a.5.5 0 01-1 0V6zM12.5 10a.5.5 0 00-1 0v2a.5.5 0 001 0v-2zM7.5 10a.5.5 0 011 0v2a.5.5 0 01-1 0v-2z" clipRule="evenodd" /></svg>, title: 'Secure PDF Exports', description: 'Generate cryptographically signed, print-ready audit reports for any block on the chain.' }
];

const FeatureCard: React.FC<{ icon: React.ReactNode; title: string; description: string }> = ({ icon, title, description }) => (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 flex flex-col items-start">
        <div className="p-3 rounded-full bg-slate-800 border border-slate-700 mb-4 text-electric-green">{icon}</div>
        <h3 className="text-xl font-semibold text-slate-100 mb-2">{title}</h3>
        <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
    </div>
);


const LandingScreen: React.FC<{ onEnterPortal: () => void }> = ({ onEnterPortal }) => {
    const [activeSlide, setActiveSlide] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setActiveSlide((prev) => (prev + 1) % slides.length);
        }, 5000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col">
            <div className="flex-grow flex items-center justify-center">
                <div className="text-center p-8 max-w-4xl mx-auto w-full">
                    <div className="relative h-64 flex items-center justify-center overflow-hidden mb-8">
                        {slides.map((slide, index) => (
                            <div key={index} className={`absolute w-full transition-opacity duration-500 ${activeSlide === index ? 'opacity-100' : 'opacity-0'}`}>
                                {activeSlide === index && (
                                    <div className="animate-zoomIn flex flex-col items-center">
                                        {icons[slide.icon as keyof typeof icons]}
                                        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-slate-200 mt-4 leading-tight">
                                          {slide.lines.map((line, i) => (
                                              <span key={i} className="block">{line}</span>
                                          ))}
                                        </h1>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-center space-x-2 mb-12">
                        {slides.map((_, index) => (
                            <button key={index} onClick={() => setActiveSlide(index)} className={`h-2 rounded-full transition-all duration-300 ${activeSlide === index ? 'w-6 bg-electric-blue' : 'w-2 bg-slate-700'}`}></button>
                        ))}
                    </div>

                    <button onClick={onEnterPortal} className="bg-electric-blue text-slate-950 font-bold py-3 px-8 rounded-lg text-lg hover:bg-electric-blue-600 transition-colors transform hover:scale-105">
                        Enter Secure Portal
                    </button>
                </div>
            </div>
            
            <div className="bg-slate-950 py-16 sm:py-24">
                <div className="max-w-7xl mx-auto px-6 lg:px-8">
                    <div className="text-center">
                        <h2 className="text-base font-semibold leading-7 text-electric-blue">Platform Capabilities</h2>
                        <p className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">The Auditor's Complete Toolkit</p>
                    </div>
                    <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                        {features.map(feature => (
                            <FeatureCard key={feature.title} icon={feature.icon} title={feature.title} description={feature.description} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LandingScreen;
