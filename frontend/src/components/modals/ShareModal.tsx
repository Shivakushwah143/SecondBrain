import React, { useRef, useState } from "react";
import { FiCheck, FiCopy, FiLink, FiMail, FiShare2, FiX } from "react-icons/fi";
import { SiTelegram, SiWhatsapp, SiX, SiLinkedin } from "react-icons/si";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareLink: string;
  isSharing: boolean;
  onToggleShare: () => void;
}

const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  shareLink,
  isSharing,
  onToggleShare,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const linkRef = useRef<HTMLInputElement | null>(null);

  const copyToClipboard = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-[#FBF7F1] dark:bg-[#141821] rounded-2xl shadow-2xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#D0C0AE] dark:border-[#2A3442] flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-[#161A21] dark:text-[#E9EDF5]">
              Share Your Knowledge
            </h2>
            <p className="text-sm text-[#515A66] dark:text-[#9AA3B2]">
              Create a public link to share your content
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-[#707885] dark:text-[#8D95A3] hover:text-[#515A66] dark:hover:text-[#9AA3B2] transition-colors"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Toggle Section */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="font-semibold text-[#161A21] dark:text-[#E9EDF5]">
                Public Sharing
              </h3>
              <p className="text-sm text-[#515A66] dark:text-[#9AA3B2] mt-1">
                Anyone with the link can view your shared content
              </p>
            </div>

            <button
              onClick={onToggleShare}
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
                isSharing
                  ? "bg-[#B35A3C] dark:bg-[#1E5A58]"
                  : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-[#FBF7F1] dark:bg-[#141821] transition-transform duration-200 ${
                  isSharing ? "translate-x-7" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* When Sharing Enabled */}
          {isSharing && shareLink && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-sm text-[#A46A3B] bg-[#F3EEE7] dark:bg-[#1B1F2A] p-3 rounded-lg">
                <FiLink className="w-4 h-4 flex-shrink-0" />
                <span>Share link is now active</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(shareLink)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-[#D0C0AE] bg-[#E7DED2] px-4 py-2 text-sm font-medium text-[#323845] hover:border-[#B35A3C]/40 hover:opacity-90 transition-all"
                  aria-label="Share on WhatsApp"
                >
                  <SiWhatsapp className="h-4 w-4 text-[#25D366]" />
                  WhatsApp
                </a>
                <a
                  href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareLink)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-[#D0C0AE] bg-[#E7DED2] px-4 py-2 text-sm font-medium text-[#323845] hover:border-[#B35A3C]/40 hover:opacity-90 transition-all"
                  aria-label="Share on X"
                >
                  <SiX className="h-4 w-4" />
                  X
                </a>
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareLink)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-[#D0C0AE] bg-[#E7DED2] px-4 py-2 text-sm font-medium text-[#323845] hover:border-[#B35A3C]/40 hover:opacity-90 transition-all"
                  aria-label="Share on LinkedIn"
                >
                  <SiLinkedin className="h-4 w-4 text-[#0A66C2]" />
                  LinkedIn
                </a>
                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(shareLink)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-[#D0C0AE] bg-[#E7DED2] px-4 py-2 text-sm font-medium text-[#323845] hover:border-[#B35A3C]/40 hover:opacity-90 transition-all"
                  aria-label="Share on Telegram"
                >
                  <SiTelegram className="h-4 w-4 text-[#229ED9]" />
                  Telegram
                </a>
                <a
                  href={`mailto:?subject=${encodeURIComponent('Second Brain Share')}&body=${encodeURIComponent(shareLink)}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#D0C0AE] bg-[#E7DED2] px-4 py-2 text-sm font-medium text-[#323845] hover:border-[#B35A3C]/40 hover:opacity-90 transition-all"
                  aria-label="Share via Email"
                >
                  <FiMail className="h-4 w-4" />
                  Email
                </a>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    ref={linkRef}
                    type="text"
                    value={shareLink}
                    readOnly
                    className="flex-grow px-4 py-3 border-2 border-[#D0C0AE] dark:border-[#2A3442] rounded-xl bg-[#F3EEE7] dark:bg-[#0E1014] text-sm focus:outline-none focus:border-[#B35A3C]/40"
                  />

                  <button
                    onClick={copyToClipboard}
                    className="px-5 py-3 bg-[#B35A3C] dark:bg-[#1E5A58] text-white font-medium rounded-xl hover:opacity-90 transition-all duration-200 flex items-center space-x-2"
                  >
                    {copied ? (
                      <>
                        <FiCheck className="w-4 h-4" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <FiCopy className="w-4 h-4" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="bg-[#F3EEE7] dark:bg-[#0E1014] rounded-lg p-4">
                  <p className="text-sm text-[#515A66] dark:text-[#9AA3B2]">
                    Share this link with colleagues, friends, or post it
                    anywhere. Viewers will see all your public content in a
                    clean, organized interface.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* When Sharing Disabled */}
          {!isSharing && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-[#E7DED2] dark:bg-[#1B1F2A] rounded-2xl flex items-center justify-center mx-auto mb-6">
                <FiShare2 className="w-10 h-10 text-[#707885] dark:text-[#8D95A3]" />
              </div>

              <p className="text-[#161A21] dark:text-[#E9EDF5] font-medium mb-2">
                Sharing is currently disabled
              </p>

              <p className="text-[#515A66] dark:text-[#9AA3B2] text-sm">
                Turn on sharing to generate a public link for your content.
                Your data remains private until you share it.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#D0C0AE] dark:border-[#2A3442] bg-[#F3EEE7] dark:bg-[#0E1014] rounded-b-2xl">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-[#FBF7F1] dark:bg-[#141821] text-[#323845] dark:text-[#C7D0DD] font-medium rounded-xl border-2 border-[#D0C0AE] dark:border-[#2A3442] hover:border-gray-400 hover:bg-[#F3EEE7] dark:hover:bg-[#0F1523] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;





