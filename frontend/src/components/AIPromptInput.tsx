import { useState, useRef, useEffect } from 'react';
import { Sparkle, PaperPlaneTilt } from '@phosphor-icons/react';

interface AIPromptInputProps {
  selectedElement: {
    selector: string;
  } | null;
  isProcessing: boolean;
  onSubmitPrompt: (prompt: string) => void;
}

export default function AIPromptInput({
  selectedElement,
  isProcessing,
  onSubmitPrompt
}: AIPromptInputProps) {
  const [prompt, setPrompt] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [prompt]);

  const handleSubmit = () => {
    if (!prompt.trim() || !selectedElement || isProcessing) return;

    onSubmitPrompt(prompt);
    setPrompt('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="bg-white rounded-lg p-4 border border space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">AI Instructions</h3>
        {selectedElement && (
          <span className="text-xs text-purple-600 font-mono">
            {selectedElement.selector}
          </span>
        )}
      </div>

      {!selectedElement ? (
        <div className="bg-primary rounded p-4 text-center border-2 border-dashed border">
          <p className="text-sm text-gray-600 mb-1">No element selected</p>
          <p className="text-xs text-gray-500">
            Select an element to give AI instructions
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isProcessing}
            placeholder="Describe the changes you want to make..."
            className="w-full bg-white text-gray-900 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 border border disabled:opacity-50 disabled:cursor-not-allowed min-h-[80px] max-h-[200px] placeholder:text-gray-400"
            rows={3}
          />

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setPrompt('Change the text to: ')}
              disabled={isProcessing}
              className="text-xs px-2 py-1 rounded bg-primary text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50 border border"
            >
              Change text
            </button>
            <button
              onClick={() => setPrompt('Change the color to: ')}
              disabled={isProcessing}
              className="text-xs px-2 py-1 rounded bg-primary text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50 border border"
            >
              Change color
            </button>
            <button
              onClick={() => setPrompt('Make it larger')}
              disabled={isProcessing}
              className="text-xs px-2 py-1 rounded bg-primary text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50 border border"
            >
              Make larger
            </button>
            <button
              onClick={() => setPrompt('Hide this element')}
              disabled={isProcessing}
              className="text-xs px-2 py-1 rounded bg-primary text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50 border border"
            >
              Hide
            </button>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={!prompt.trim() || isProcessing}
            className={`w-full py-2.5 px-4 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
              isProcessing
                ? 'bg-yellow-600 text-white cursor-wait'
                : !prompt.trim()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-purple text-white hover:-translate-y-0.5 hover:shadow-[0_10px_25px_rgba(102,126,234,0.3)]'
            }`}
          >
            {isProcessing ? (
              <>
                <Sparkle size={18} weight="fill" className="animate-pulse" />
                Processing...
              </>
            ) : (
              <>
                <PaperPlaneTilt size={18} weight="fill" />
                Apply Changes
              </>
            )}
          </button>

          {/* Keyboard hint */}
          <p className="text-xs text-gray-500 text-center">
            Press {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'} + Enter to submit
          </p>
        </div>
      )}
    </div>
  );
}
