import React from 'react';
import { FiX } from 'react-icons/fi';
import { SiTelegram } from 'react-icons/si';
import type { User } from '../../types';

interface TelegramLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isLinking?: boolean;
  user?: User | null;
}

const TelegramLinkModal: React.FC<TelegramLinkModalProps> = ({
  isOpen, onClose, onSubmit, isLinking,
}) => {
  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(e);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-[#FBF7F1] dark:bg-[#141821] rounded-2xl shadow-2xl max-w-md w-full">
        <div className="px-6 py-5 border-b border-[#D0C0AE] dark:border-[#2A3442] flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-[#161A21] dark:text-[#E9EDF5]">Link Telegram Account</h2>
            <p className="text-sm text-[#515A66] dark:text-[#9AA3B2]">Connect your Telegram to save content</p>
          </div>
          <button
            onClick={onClose}
            className="text-[#707885] dark:text-[#8D95A3] hover:text-[#515A66] dark:text-[#9AA3B2] transition-colors"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-[#E7DED2] dark:bg-[#1B1F2A] rounded-xl flex items-center justify-center">
              <SiTelegram className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-[#161A21] dark:text-[#E9EDF5]">Telegram Bot</h3>
              <p className="text-sm text-[#515A66] dark:text-[#9AA3B2]">@SecondBrainBot</p>
            </div>
          </div>

          <div className="bg-[#E7DED2] dark:bg-[#1B1F2A] rounded-xl p-4 border border-[#D0C0AE]">
            <h4 className="font-medium text-[#161A21] dark:text-[#E9EDF5] mb-2">How it works:</h4>
            <ol className="text-sm text-[#515A66] dark:text-[#9AA3B2] space-y-1 list-decimal list-inside">
              <li>Click “Connect Telegram”</li>
              <li>Telegram opens and sends a secure `/start` code</li>
              <li>Your account links automatically</li>
            </ol>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-[#E7DED2] dark:bg-[#1B1F2A] hover:bg-gray-200 text-[#323845] dark:text-[#C7D0DD] font-medium rounded-xl border border-[#D0C0AE] dark:border-[#2A3442] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLinking}
              className="px-6 py-3 bg-[#B35A3C] dark:bg-[#1E5A58] text-white font-medium rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLinking ? 'Connecting…' : 'Connect Telegram'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TelegramLinkModal;







