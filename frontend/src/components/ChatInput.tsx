import { useState, useRef, useEffect } from 'react';
import { CursorClick, Image as ImageIcon, PaperPlaneRight, ArrowsOutCardinal, Eyedropper, Stop, FloppyDisk, ArrowsLeftRight } from '@phosphor-icons/react';

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
  onSelectElement: () => void;
  onColorPicker: () => void;
  onSubmitPrompt: (prompt: string) => void;
  onStopProxy?: () => void;
  isLoading?: boolean;
}

export default function ChatInput({
  selectedElement,
  isProcessing,
  isSelectionMode,
  isColorPickerMode,
  onSelectElement,
  onColorPicker,
  onSubmitPrompt,
  onStopProxy,
  isLoading
}: ChatInputProps) {
  const [prompt, setPrompt] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
      {/* Selected Element Preview */}
      {selectedElement && (
        <div className="px-4 pt-3 pb-2">
          <div className="rounded-lg px-3 py-2 border border-dashed border-gray-400">
            <p className="text-xs font-medium text-gray-900">
              Selected: <span className="font-mono">{selectedElement.tagName}</span>
            </p>
            <p className="text-xs text-gray-600 font-mono truncate">
              {selectedElement.selector}
            </p>
          </div>
        </div>
      )}

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

      {/* Action Buttons */}
      <div className="px-4 pb-2 flex gap-2">
        {/* Select Element Button */}
        <button
          onClick={onSelectElement}
          disabled={isProcessing}
          className={`p-2 rounded-md transition-all ${
            isSelectionMode
              ? 'bg-[#2563eb] text-white'
              : 'text-gray-700 hover:bg-primary-dark'
          }`}
          title={isSelectionMode ? 'Click to disable selector' : 'Select Element'}
        >
          <CursorClick size={16} weight="bold" />
        </button>

        {/* Image Upload Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          className="p-2 rounded-md text-gray-700 hover:bg-primary-dark transition-all disabled:opacity-50"
          title="Upload Image"
        >
          <ImageIcon size={16} weight="bold" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />


        {/* Color Picker Button */}
        <button
          onClick={onColorPicker}
          disabled={isProcessing}
          className={`p-2 rounded-md transition-all ${
            isColorPickerMode
              ? 'bg-[#2563eb] text-white'
              : 'text-gray-700 hover:bg-primary-dark'
          }`}
          title={isColorPickerMode ? 'Click to disable color picker' : 'Color Picker'}
        >
          <Eyedropper size={16} weight="bold" />
        </button>

        {/* Save Button */}
        <button
          disabled={isProcessing}
          className="p-2 rounded-md text-gray-700 hover:bg-primary-dark transition-all disabled:opacity-50"
          title="Save"
        >
          <FloppyDisk size={16} weight="bold" />
        </button>

        {/* Swap Button */}
        <button
          disabled={isProcessing}
          className="ml-auto p-2 rounded-md text-gray-700 hover:bg-primary-dark transition-all disabled:opacity-50"
          title="Swap"
        >
          <ArrowsLeftRight size={16} weight="bold" />
        </button>

        {/* Stop Proxy Button */}
        {onStopProxy && (
          <button
            onClick={onStopProxy}
            disabled={isLoading}
            className="p-2 rounded-md text-gray-700 hover:bg-primary-dark transition-all disabled:opacity-50"
            title="Stop Proxy"
          >
            <Stop size={16} weight="bold" />
          </button>
        )}
      </div>

      {/* Chat Input */}
      <div className="px-4 pb-4">
        {/* Text Input with Send Button */}
        <div className="bg-white rounded-lg border border overflow-hidden flex items-end">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isProcessing}
            placeholder={selectedElement ? "Describe the changes..." : "Select an element first..."}
            className="flex-1 px-3 py-3 text-sm resize-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-gray-400"
            rows={1}
            style={{ maxHeight: '120px' }}
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
      </div>
    </div>
  );
}
