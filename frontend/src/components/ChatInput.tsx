import { useState, useRef, useEffect } from 'react';
import { CursorClick, Image as ImageIcon, PaperPlaneRight, Eyedropper, ArrowClockwise, XCircle, Palette } from '@phosphor-icons/react';
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
  selectedImagePath?: string | null;
  onSelectElement: () => void;
  onClearSelection?: () => void;
  onColorPicker: () => void;
  onOpenImageGallery: () => void;
  onClearGalleryImage?: () => void;
  onSubmitPrompt: (prompt: string, image?: string | null, isAttachment?: boolean, imagePath?: string | null) => void;
  onCheckpointSaved?: () => void;
  onRefreshIframe?: () => void;
  onStopProcessing?: () => void;
}

export default function ChatInput({
  selectedElement,
  isProcessing,
  isSelectionMode,
  isColorPickerMode,
  showCheckpoints = false,
  selectedImagePath,
  onSelectElement,
  onClearSelection,
  onColorPicker,
  onOpenImageGallery,
  onClearGalleryImage,
  onSubmitPrompt,
  onCheckpointSaved,
  onRefreshIframe,
  onStopProcessing
}: ChatInputProps) {
  const [prompt, setPrompt] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [attachedImagePath, setAttachedImagePath] = useState<string | null>(null);
  const [checkpointMessage, setCheckpointMessage] = useState('');
  const [isSavingCheckpoint, setIsSavingCheckpoint] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const checkpointTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

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
    console.log('[ChatInput] Selected Image:', selectedImage ? 'Yes' : 'No');
    console.log('[ChatInput] Attached Image:', attachedImage ? 'Yes' : 'No');
    console.log('[ChatInput] Attached Image Path:', attachedImagePath);
    console.log('[ChatInput] isProcessing:', isProcessing);

    if (!prompt.trim() || isProcessing) {
      console.log('[ChatInput] ⚠️ Submission blocked - empty prompt or already processing');
      return;
    }

    // Determine which image to send and whether it's an attachment
    const isAttachment = !!attachedImage;
    const imageToSend = attachedImage || selectedImage;

    console.log('[ChatInput] ✅ Calling onSubmitPrompt', {
      isAttachment,
      hasImage: !!imageToSend,
      hasImagePath: !!attachedImagePath
    });

    // Pass the imagePath if it's an attachment
    onSubmitPrompt(prompt, imageToSend, isAttachment, attachedImagePath);
    setPrompt('');
    setSelectedImage(null);
    setAttachedImage(null);
    setAttachedImagePath(null);

    // Reset file input values to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = '';
    }
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

  const handleAttachmentSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size (5MB limit for attachments)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB for attachments');
      return;
    }

    setIsUploadingImage(true);

    try {
      // Read file as base64
      const reader = new FileReader();

      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;

        // Store preview image
        setAttachedImage(dataUrl);

        try {
          // Extract image type and base64 data
          const imageTypeMatch = dataUrl.match(/data:(image\/[^;]+);base64,/);
          const imageType = imageTypeMatch ? imageTypeMatch[1] : 'image/png';
          const base64Data = dataUrl.replace(/^data:image\/[^;]+;base64,/, '');

          console.log('[ChatInput] 📤 Uploading image immediately...');

          // Upload to backend immediately
          const response = await fetch('http://localhost:9998/__layrr/upload-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              image: base64Data,
              imageType: imageType,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Upload failed: ${errorText}`);
          }

          const result = await response.json();
          console.log('[ChatInput] ✅ Image uploaded successfully:', result.path);

          // Store the path returned from server
          setAttachedImagePath(result.path);
        } catch (error) {
          console.error('[ChatInput] ❌ Failed to upload image:', error);
          alert(`Failed to upload image: ${error}`);
          setAttachedImage(null);
          setAttachedImagePath(null);
        } finally {
          setIsUploadingImage(false);
        }
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('[ChatInput] ❌ Failed to read file:', error);
      alert('Failed to read image file');
      setIsUploadingImage(false);
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

      {/* Selected Image Preview (for design analysis) */}
      {selectedImage && (
        <div className="px-4 pb-2">
          <div className="relative inline-block">
            <div className="text-xs text-purple-600 font-medium mb-1">Design to analyze</div>
            <img
              src={selectedImage}
              alt="Selected"
              className="h-20 rounded-lg border-2 border-purple-500"
            />
            <button
              onClick={() => {
                setSelectedImage(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Attached Image Preview (for file attachment) */}
      {attachedImage && (
        <div className="px-4 pb-2">
          <div className="relative inline-block">
            <div className="text-xs text-blue-600 font-medium mb-1">Image to attach</div>
            <img
              src={attachedImage}
              alt="Attached"
              className="h-20 rounded-lg border-2 border-blue-500"
            />
            <button
              onClick={() => {
                setAttachedImage(null);
                setAttachedImagePath(null);
                if (attachmentInputRef.current) {
                  attachmentInputRef.current.value = '';
                }
              }}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Gallery Selected Image Preview */}
      {selectedImagePath && (
        <div className="px-4 pb-2">
          <div className="relative inline-block">
            <div className="text-xs text-green-600 font-medium mb-1">Selected from gallery</div>
            <img
              src={`http://localhost:9998${selectedImagePath}`}
              alt="Gallery Selected"
              className="h-20 rounded-lg border-2 border-green-500"
            />
            <button
              onClick={onClearGalleryImage}
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

        {/* Design Analysis Button (palette icon) */}
        <motion.button
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          className="p-2 rounded-md text-gray-700 hover:bg-primary-dark transition-all disabled:opacity-50"
          title="Analyze Design Image"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Palette size={16} weight="bold" />
        </motion.button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />

        {/* Image Gallery Button (image icon) */}
        <motion.button
          onClick={onOpenImageGallery}
          disabled={isProcessing}
          className="p-2 rounded-md text-gray-700 hover:bg-primary-dark transition-all disabled:opacity-50"
          title="Image Gallery"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <ImageIcon size={16} weight="bold" />
        </motion.button>

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

        {/* Spacer to push right-side buttons to the end */}
        <div className="flex-1"></div>

        {/* Refresh Iframe Button */}
        <motion.button
          onClick={onRefreshIframe}
          disabled={isProcessing}
          className="p-2 rounded-md text-gray-700 hover:bg-primary-dark transition-all disabled:opacity-50"
          title="Refresh Preview"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <ArrowClockwise size={16} weight="bold" />
        </motion.button>

        {/* Stop Processing Button - Only active when processing */}
        <motion.button
          onClick={onStopProcessing}
          disabled={!isProcessing}
          className={`p-2 rounded-md transition-all ${
            isProcessing
              ? 'text-red-600 hover:bg-red-50'
              : 'text-gray-400 cursor-not-allowed opacity-50'
          }`}
          title={isProcessing ? 'Stop Processing' : 'No active processing'}
          whileHover={isProcessing ? { scale: 1.05 } : {}}
          whileTap={isProcessing ? { scale: 0.95 } : {}}
        >
          <XCircle size={16} weight="bold" />
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
