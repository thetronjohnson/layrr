import { useState } from 'react';
import { Camera, CaretDown, CaretUp, DownloadSimple } from '@phosphor-icons/react';

interface ScreenshotViewerProps {
  screenshot: string | null;
  onCaptureScreenshot: () => void;
  isCapturing: boolean;
}

export default function ScreenshotViewer({
  screenshot,
  onCaptureScreenshot,
  isCapturing
}: ScreenshotViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white rounded-lg p-4 border border space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Screenshot</h3>
        <button
          onClick={onCaptureScreenshot}
          disabled={isCapturing}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
            isCapturing
              ? 'bg-gray-300 text-gray-600 cursor-wait'
              : 'bg-gradient-purple text-white hover:-translate-y-0.5'
          }`}
        >
          <Camera size={16} weight="bold" />
          {isCapturing ? 'Capturing...' : 'Capture'}
        </button>
      </div>

      {screenshot ? (
        <div className="space-y-2">
          <div
            className={`relative bg-primary rounded overflow-hidden border border cursor-pointer transition-all ${
              isExpanded ? 'max-h-96' : 'max-h-48'
            }`}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <img
              src={screenshot}
              alt="Preview Screenshot"
              className="w-full h-full object-contain"
            />
            {!isExpanded && (
              <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent opacity-50" />
            )}
          </div>

          <div className="flex items-center justify-between text-xs">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-purple-600 hover:text-purple-700 transition-colors flex items-center gap-1"
            >
              {isExpanded ? (
                <>
                  <CaretUp size={14} weight="bold" />
                  Collapse
                </>
              ) : (
                <>
                  <CaretDown size={14} weight="bold" />
                  Expand
                </>
              )}
            </button>
            <a
              href={screenshot}
              download="layrr-screenshot.png"
              className="text-purple-600 hover:text-purple-700 transition-colors flex items-center gap-1"
            >
              <DownloadSimple size={14} weight="bold" />
              Download
            </a>
          </div>
        </div>
      ) : (
        <div className="bg-primary rounded p-8 text-center border-2 border-dashed border">
          <p className="text-sm text-gray-600 mb-2">No screenshot captured</p>
          <p className="text-xs text-gray-500">
            Click "Capture" to take a screenshot of the current view
          </p>
        </div>
      )}
    </div>
  );
}
