import { useState, useRef, useEffect } from 'react';
import { CursorClick, Image as ImageIcon, PaperPlaneRight, Eyedropper } from '@phosphor-icons/react';
import { CreateGitCheckpoint } from '../../wailsjs/go/main/App';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatInputProps {
  selectedElement: {
    tagName: string;
    selector: string;
    bounds: {
      width: number;
      height: number;
    };
  } | null;
  isProcessing: boolean;
  isSelectionMode: boolean;
  isColorPickerMode: boolean;
  showCheckpoints?: boolean;
  onSelectElement: () => void;
  onClearSelection?: () => void;
  onColorPicker: () => void;
  onSubmitPrompt: (prompt: string) => void;
  onCheckpointSaved?: () => void;
}

export default function ChatInput({
  selectedElement,
  isProcessing,
  isSelectionMode,
  isColorPickerMode,
  showCheckpoints = false,
  onSelectElement,
  onClearSelection,
  onColorPicker,
  onSubmitPrompt,
  onCheckpointSaved
}: ChatInputProps) {
  const [prompt, setPrompt] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [checkpointMessage, setCheckpointMessage] = useState('');
  const [isSavingCheckpoint, setIsSavingCheckpoint] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const checkpointTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [prompt]);

  const handleSubmit = () => {
    console.log('[ChatInput] 🔥 handleSubmit called!');
    console.log('[ChatInput] Prompt:', prompt);
    console.log('[ChatInput] isProcessing:', isProcessing);

    if (!prompt.trim() || isProcessing) {
      console.log('[ChatInput] ⚠️ Submission blocked - empty prompt or already processing');
      return;
    }

    console.log('[ChatInput] ✅ Calling onSubmitPrompt');
    onSubmitPrompt(prompt);
    setPrompt('');
    setSelectedImage(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCheckpointKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSaveCheckpoint();
    }
  };

  const handleSaveCheckpoint = async () => {
    if (!checkpointMessage.trim() || isSavingCheckpoint) return;

    setIsSavingCheckpoint(true);
    try {
      await CreateGitCheckpoint(checkpointMessage);
      setCheckpointMessage('');
      if (onCheckpointSaved) {
        onCheckpointSaved();
      }
    } catch (err) {
      console.error('Failed to save checkpoint:', err);
    } finally {
      setIsSavingCheckpoint(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setSelectedImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="border-t border bg-primary">
      {/* Selected Element Preview - Hidden when checkpoints view is shown */}
      <AnimatePresence>
        {selectedElement && !showCheckpoints && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="px-4 pt-3 pb-2 overflow-hidden"
          >
            <motion.div
              initial={{ y: -10 }}
              animate={{ y: 0 }}
              className="rounded-lg px-3 py-2 border border-dashed border-gray-400 relative"
            >
              <motion.button
                onClick={onClearSelection}
                className="absolute -top-2 -right-2 w-5 h-5 bg-gray-400 text-white rounded-full flex items-center justify-center text-xs hover:bg-gray-500 transition-colors"
                title="Clear selection"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                ×
              </motion.button>
              <p className="text-xs font-medium text-gray-900">
                Selected: <span className="font-mono">{selectedElement.tagName}</span>
              </p>
              <p className="text-xs text-gray-600 font-mono truncate">
                {selectedElement.selector}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected Image Preview */}
      {selectedImage && (
        <div className="px-4 pb-2">
          <div className="relative inline-block">
            <img
              src={selectedImage}
              alt="Selected"
              className="h-20 rounded-lg border border"
            />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons - Hidden when checkpoints view is shown */}
      {!showCheckpoints && (
        <div className="px-4 pb-2 pt-2 flex gap-2 border-t border-gray-300">
        {/* Select Element Button */}
        <motion.button
          onClick={onSelectElement}
          disabled={isProcessing}
          className={`p-2 rounded-md transition-all ${
            isSelectionMode
              ? 'bg-[#2563eb] text-white'
              : 'text-gray-700 hover:bg-primary-dark'
          }`}
          title={isSelectionMode ? 'Click to disable selector' : 'Select Element'}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <CursorClick size={16} weight="bold" />
        </motion.button>

        {/* Image Upload Button */}
        <motion.button
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          className="p-2 rounded-md text-gray-700 hover:bg-primary-dark transition-all disabled:opacity-50"
          title="Upload Image"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <ImageIcon size={16} weight="bold" />
        </motion.button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />


        {/* Color Picker Button */}
        <motion.button
          onClick={onColorPicker}
          disabled={isProcessing}
          className={`p-2 rounded-md transition-all ${
            isColorPickerMode
              ? 'bg-[#2563eb] text-white'
              : 'text-gray-700 hover:bg-primary-dark'
          }`}
          title={isColorPickerMode ? 'Click to disable color picker' : 'Color Picker'}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Eyedropper size={16} weight="bold" />
        </motion.button>
        </div>
      )}

      {/* Chat Input / Checkpoint Input */}
      <div className="px-4 pb-4">
        {showCheckpoints ? (
          /* Checkpoint Input */
          <div className="space-y-2">
            <textarea
              ref={checkpointTextareaRef}
              value={checkpointMessage}
              onChange={(e) => setCheckpointMessage(e.target.value)}
              onKeyDown={handleCheckpointKeyDown}
              placeholder="Describe your changes..."
              className="w-full px-4 py-4 bg-white border border-gray-300 rounded-lg text-black text-sm resize-none focus:outline-none focus:border-purple-500 focus:shadow-[0_0_0_2px_rgba(102,126,234,0.1)] placeholder:text-gray-400"
              rows={2}
              style={{ maxHeight: '120px' }}
            />
            <button
              onClick={handleSaveCheckpoint}
              disabled={isSavingCheckpoint || !checkpointMessage.trim()}
              className="w-full px-4 py-2 text-white text-sm font-semibold rounded-lg transition-all disabled:cursor-not-allowed"
              style={{ backgroundColor: isSavingCheckpoint || !checkpointMessage.trim() ? '#6B7280' : '#000000' }}
              onMouseEnter={(e) => {
                if (!(isSavingCheckpoint || !checkpointMessage.trim())) {
                  e.currentTarget.style.backgroundColor = '#1F2937';
                }
              }}
              onMouseLeave={(e) => {
                if (!(isSavingCheckpoint || !checkpointMessage.trim())) {
                  e.currentTarget.style.backgroundColor = '#000000';
                }
              }}
            >
              {isSavingCheckpoint ? 'Saving...' : 'Save Checkpoint'}
            </button>
          </div>
        ) : (
          /* Regular Chat Input */
          <div className="bg-white rounded-lg border border overflow-hidden flex items-end">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isProcessing}
              placeholder={selectedElement ? "Describe the changes..." : "Select an element first..."}
              className="flex-1 px-4 py-4 text-sm resize-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-gray-400"
              rows={2}
              style={{ maxHeight: '150px', minHeight: '60px' }}
            />
            {/* Send Button Inside Input */}
            <button
              onClick={handleSubmit}
              disabled={!prompt.trim() || isProcessing}
              className={`flex-shrink-0 p-3 transition-all ${
                !prompt.trim() || isProcessing
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-button hover:opacity-70'
              }`}
              title="Send"
            >
              {isProcessing ? (
                <div className="animate-spin w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full"></div>
              ) : (
                <PaperPlaneRight size={20} weight="fill" />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
