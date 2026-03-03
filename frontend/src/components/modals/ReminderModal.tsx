import React from 'react';
import { FiX } from 'react-icons/fi';
import type { NewReminder, ReminderRepeat } from '../../types';

interface ReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  newReminder: NewReminder;
  setNewReminder: (reminder: NewReminder) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const ReminderModal: React.FC<ReminderModalProps> = ({
  isOpen, onClose, newReminder, setNewReminder, onSubmit,
}) => {
  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(e);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-[#FBF7F1] dark:bg-[#141821] rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-[#D0C0AE] dark:border-[#2A3442] flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-[#161A21] dark:text-[#E9EDF5]">Set New Reminder</h2>
            <p className="text-sm text-[#515A66] dark:text-[#9AA3B2]">Create reminders for important content</p>
          </div>
          <button
            onClick={onClose}
            className="text-[#707885] dark:text-[#8D95A3] hover:text-[#515A66] dark:text-[#9AA3B2] transition-colors"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#323845] dark:text-[#C7D0DD] mb-2">
              Title *
            </label>
            <input
              type="text"
              value={newReminder.title}
              onChange={(e) => setNewReminder({ ...newReminder, title: e.target.value })}
              className="w-full px-4 py-3 border border-[#D0C0AE] dark:border-[#2A3442] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B35A3C]/40 dark:focus:ring-[#1E5A58]/50 focus:border-transparent transition-all text-[#161A21] dark:text-[#E9EDF5] placeholder:text-[#8D95A3]"
              placeholder="Reminder title"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#323845] dark:text-[#C7D0DD] mb-2">
              Description (Optional)
            </label>
            <textarea
              value={newReminder.description}
              onChange={(e) => setNewReminder({ ...newReminder, description: e.target.value })}
              className="w-full px-4 py-3 border border-[#D0C0AE] dark:border-[#2A3442] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B35A3C]/40 dark:focus:ring-[#1E5A58]/50 focus:border-transparent transition-all resize-none text-[#161A21] dark:text-[#E9EDF5] placeholder:text-[#8D95A3]"
              rows={3}
              placeholder="Additional details about the reminder"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#323845] dark:text-[#C7D0DD] mb-2">
                Date & Time *
              </label>
              <input
                type="datetime-local"
                value={newReminder.reminderTime}
                onChange={(e) => setNewReminder({ ...newReminder, reminderTime: e.target.value })}
                className="w-full px-4 py-3 border border-[#D0C0AE] dark:border-[#2A3442] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B35A3C]/40 dark:focus:ring-[#1E5A58]/50 focus:border-transparent text-[#161A21] dark:text-[#E9EDF5]"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#323845] dark:text-[#C7D0DD] mb-2">
                Repeat
              </label>
              <select
                value={newReminder.repeat}
                onChange={(e) => setNewReminder({ ...newReminder, repeat: e.target.value as ReminderRepeat })}
                className="w-full px-4 py-3 border border-[#D0C0AE] dark:border-[#2A3442] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B35A3C]/40 dark:focus:ring-[#1E5A58]/50 focus:border-transparent text-[#161A21] dark:text-[#E9EDF5]"
              >
                <option value="once">Once</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>

          <div className="bg-[#E7DED2] dark:bg-[#1B1F2A] rounded-xl p-4 border border-[#D0C0AE]">
            <p className="text-sm text-[#515A66] dark:text-[#9AA3B2]">
              Telegram notifications are sent automatically once your Telegram is connected.
            </p>
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t border-[#D0C0AE] dark:border-[#2A3442]">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-[#E7DED2] dark:bg-[#1B1F2A] hover:bg-gray-200 text-[#323845] dark:text-[#C7D0DD] font-medium rounded-xl border border-[#D0C0AE] dark:border-[#2A3442] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newReminder.title || !newReminder.reminderTime}
              className="px-6 py-3 bg-[#B35A3C] dark:bg-[#1E5A58] text-white font-medium rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Set Reminder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReminderModal;






