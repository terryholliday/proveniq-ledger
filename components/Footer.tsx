import React, { useState } from 'react';
import LegalModal from './LegalModal';

type ModalType = 'privacy' | 'terms' | 'contact' | null;

const Footer: React.FC = () => {
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  return (
    <>
      <footer className="bg-slate-950/95 backdrop-blur-sm border-t border-slate-700 py-6 relative z-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-electric-blue font-bold">PROVENIQ</span>
              <span className="text-slate-400">|</span>
              <span className="text-slate-300 text-sm">Ledger</span>
            </div>
            <p className="text-slate-300 text-sm">
              © 2025-2026 Proveniq. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-sm">
              <button 
                onClick={() => setActiveModal('privacy')} 
                className="text-slate-300 hover:text-white transition-colors"
              >
                Privacy
              </button>
              <button 
                onClick={() => setActiveModal('terms')} 
                className="text-slate-300 hover:text-white transition-colors"
              >
                Terms
              </button>
              <button 
                onClick={() => setActiveModal('contact')} 
                className="text-slate-300 hover:text-white transition-colors"
              >
                Contact
              </button>
            </div>
          </div>
        </div>
      </footer>

      {activeModal && (
        <LegalModal
          type={activeModal}
          isOpen={true}
          onClose={() => setActiveModal(null)}
        />
      )}
    </>
  );
};

export default Footer;
