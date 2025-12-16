import React from 'react';

type LegalModalType = 'privacy' | 'terms' | 'contact';

interface LegalModalProps {
  type: LegalModalType;
  isOpen: boolean;
  onClose: () => void;
}

const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const LEGAL_CONTENT: Record<LegalModalType, { title: string; content: React.ReactNode }> = {
  privacy: {
    title: 'Privacy Policy',
    content: (
      <div className="space-y-4">
        <p className="text-slate-300">
          <strong className="text-white">Effective Date:</strong> January 1, 2025
        </p>
        
        <section>
          <h3 className="text-lg font-semibold text-white mb-2">1. Information We Collect</h3>
          <p className="text-slate-300">
            Proveniq Ledger collects only the minimum information necessary to provide our services:
          </p>
          <ul className="list-disc list-inside text-slate-300 mt-2 space-y-1">
            <li>Wallet identifiers (pseudonymous)</li>
            <li>Transaction and event data related to asset provenance</li>
            <li>Device and usage information for security purposes</li>
          </ul>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-white mb-2">2. Zero PII Policy</h3>
          <p className="text-slate-300">
            The Proveniq Ledger is designed with a <strong className="text-electric-blue">Zero PII (Personally Identifiable Information)</strong> architecture. 
            We do not store names, emails, or other personal identifiers in the immutable ledger. All actors are represented by pseudonymous wallet IDs.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-white mb-2">3. Data Security</h3>
          <p className="text-slate-300">
            All data is encrypted in transit and at rest. Our ledger uses cryptographic hash chains to ensure data integrity and immutability. 
            Access is controlled via mTLS and JWT authentication.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-white mb-2">4. Data Retention</h3>
          <p className="text-slate-300">
            Ledger entries are immutable and retained permanently as part of the provenance record. 
            This is essential for maintaining the integrity of asset history and verification.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-white mb-2">5. Your Rights</h3>
          <p className="text-slate-300">
            You have the right to access your transaction history and verify the integrity of any records associated with your wallet ID. 
            Contact us for data access requests.
          </p>
        </section>
      </div>
    ),
  },
  terms: {
    title: 'Terms of Service',
    content: (
      <div className="space-y-4">
        <p className="text-slate-300">
          <strong className="text-white">Last Updated:</strong> January 1, 2025
        </p>

        <section>
          <h3 className="text-lg font-semibold text-white mb-2">1. Acceptance of Terms</h3>
          <p className="text-slate-300">
            By accessing or using Proveniq Ledger, you agree to be bound by these Terms of Service and all applicable laws and regulations.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-white mb-2">2. Service Description</h3>
          <p className="text-slate-300">
            Proveniq Ledger provides an immutable, append-only ledger for recording and verifying the provenance of physical assets. 
            The service includes:
          </p>
          <ul className="list-disc list-inside text-slate-300 mt-2 space-y-1">
            <li>Event recording and hash chain verification</li>
            <li>Custody state tracking</li>
            <li>Integration APIs for partner applications</li>
            <li>Fraud detection and risk analysis</li>
          </ul>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-white mb-2">3. User Responsibilities</h3>
          <p className="text-slate-300">
            Users are responsible for maintaining the security of their credentials and ensuring the accuracy of information submitted to the ledger. 
            Once recorded, entries cannot be modified or deleted.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-white mb-2">4. Immutability</h3>
          <p className="text-slate-300">
            All entries in the Proveniq Ledger are <strong className="text-electric-blue">permanent and immutable</strong>. 
            By submitting data, you acknowledge that it cannot be altered or removed. Corrections must be made via new entries that reference the original.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-white mb-2">5. Limitation of Liability</h3>
          <p className="text-slate-300">
            Proveniq provides the ledger service "as is" without warranties of any kind. We are not liable for any indirect, incidental, 
            or consequential damages arising from use of the service.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-white mb-2">6. Governing Law</h3>
          <p className="text-slate-300">
            These terms are governed by the laws of the jurisdiction in which Proveniq operates, without regard to conflict of law principles.
          </p>
        </section>
      </div>
    ),
  },
  contact: {
    title: 'Contact Us',
    content: (
      <div className="space-y-6">
        <p className="text-slate-300">
          Have questions about Proveniq Ledger? We're here to help.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-800/50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-2">General Inquiries</h3>
            <p className="text-slate-300 text-sm">
              <a href="mailto:info@proveniq.com" className="text-electric-blue hover:underline">info@proveniq.com</a>
            </p>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-2">Technical Support</h3>
            <p className="text-slate-300 text-sm">
              <a href="mailto:support@proveniq.com" className="text-electric-blue hover:underline">support@proveniq.com</a>
            </p>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-2">Partnership Inquiries</h3>
            <p className="text-slate-300 text-sm">
              <a href="mailto:partners@proveniq.com" className="text-electric-blue hover:underline">partners@proveniq.com</a>
            </p>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-2">Security Issues</h3>
            <p className="text-slate-300 text-sm">
              <a href="mailto:security@proveniq.com" className="text-electric-blue hover:underline">security@proveniq.com</a>
            </p>
          </div>
        </div>

        <div className="border-t border-slate-700 pt-4">
          <h3 className="text-lg font-semibold text-white mb-2">Response Times</h3>
          <p className="text-slate-300 text-sm">
            We aim to respond to all inquiries within 24-48 business hours. For urgent security matters, 
            please include "URGENT" in your subject line.
          </p>
        </div>
      </div>
    ),
  },
};

const LegalModal: React.FC<LegalModalProps> = ({ type, isOpen, onClose }) => {
  if (!isOpen) return null;

  const { title, content } = LEGAL_CONTENT[type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <XIcon />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {content}
        </div>
        <div className="p-4 border-t border-slate-700 bg-slate-800/50">
          <button
            onClick={onClose}
            className="w-full bg-electric-blue text-slate-950 font-semibold py-2 px-4 rounded-lg hover:bg-electric-blue/90 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default LegalModal;
