import React, { useEffect, useRef } from 'react';
import { useLayyrrStore } from '../../store';

/**
 * DesignAnalyzer component
 * AI analysis interface for design prompts
 * - Textarea for custom design prompts
 * - "Analyze Design" button to trigger analysis
 * - Shows analysis steps: analyzing → sending → processing
 * - Progress indicator with spinner animation
 * - Error display with retry option
 */
interface DesignAnalyzerProps {
  /** Base64 encoded image string or null */
  image: string | null;
  /** MIME type of the image */
  imageType: string;
}

const DesignAnalyzer: React.FC<DesignAnalyzerProps> = (_props) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    designPrompt,
    setDesignPrompt,
    startAnalysis,
    isAnalyzing,
    analysisStep,
    analysisError,
  } = useLayyrrStore();

  // Auto-focus textarea when component mounts
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  /**
   * Handle textarea change
   */
  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDesignPrompt(e.target.value);
  };

  /**
   * Handle analyze button click
   */
  const handleAnalyze = () => {
    if (!designPrompt.trim()) {
      return;
    }
    startAnalysis();
  };

  /**
   * Get step description for display
   */
  const getStepDescription = (): string => {
    switch (analysisStep) {
      case 'analyzing':
        return 'Analyzing design...';
      case 'sending':
        return 'Sending to AI...';
      case 'processing':
        return 'Processing response...';
      default:
        return '';
    }
  };

  return (
    <div className="vc-design-analyzer">
      {/* Prompt Textarea */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label
          htmlFor="design-prompt"
          style={{
            fontSize: '13px',
            fontWeight: '600',
            color: 'rgb(75, 85, 99)',
          }}
        >
          Design Instructions
        </label>
        <textarea
          ref={textareaRef}
          id="design-prompt"
          value={designPrompt}
          onChange={handlePromptChange}
          placeholder="Describe what you want to build from this design..."
          className="vc-design-analyzer-textarea"
          disabled={isAnalyzing}
          style={{
            width: '100%',
            minHeight: '100px',
            maxHeight: '150px',
            padding: '12px',
            border: isAnalyzing
              ? '1px solid rgb(209, 213, 219)'
              : '1px solid rgb(209, 213, 219)',
            borderRadius: '6px',
            fontSize: '14px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", monospace',
            color: isAnalyzing ? 'rgb(156, 163, 175)' : 'rgb(31, 41, 55)',
            background: isAnalyzing ? 'rgb(249, 250, 251)' : 'white',
            outline: 'none',
            resize: 'vertical',
            boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.05)',
            transition: 'all 0.2s',
          }}
          onFocus={(e) => {
            if (!isAnalyzing) {
              (e.target as HTMLTextAreaElement).style.borderColor =
                'rgb(168, 85, 247)';
              (e.target as HTMLTextAreaElement).style.boxShadow =
                'inset 0 1px 3px rgba(0, 0, 0, 0.05), 0 0 0 3px rgba(168, 85, 247, 0.1)';
            }
          }}
          onBlur={(e) => {
            (e.target as HTMLTextAreaElement).style.borderColor =
              'rgb(209, 213, 219)';
            (e.target as HTMLTextAreaElement).style.boxShadow =
              'inset 0 1px 3px rgba(0, 0, 0, 0.05)';
          }}
        />
      </div>

      {/* Error Display */}
      {analysisError && (
        <div
          className="vc-design-analyzer-error"
          style={{
            padding: '12px',
            borderRadius: '6px',
            background: 'rgb(254, 242, 242)',
            border: '1px solid rgb(254, 202, 202)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
          }}
        >
          <span style={{ fontSize: '16px', flexShrink: 0 }}>⚠️</span>
          <div>
            <p
              style={{
                margin: 0,
                fontSize: '13px',
                fontWeight: '500',
                color: 'rgb(127, 29, 29)',
              }}
            >
              Analysis failed
            </p>
            <p
              style={{
                margin: '4px 0 0 0',
                fontSize: '12px',
                color: 'rgb(153, 27, 27)',
              }}
            >
              {analysisError}
            </p>
          </div>
        </div>
      )}

      {/* Analysis Progress */}
      {isAnalyzing && (
        <div
          className="vc-design-analyzer-progress"
          style={{
            padding: '16px',
            borderRadius: '6px',
            background: 'rgb(240, 249, 255)',
            border: '1px solid rgb(186, 230, 253)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          {/* Spinner */}
          <div
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              border: '2px solid rgb(168, 85, 247)',
              borderTopColor: 'transparent',
              animation: 'spin 0.8s linear infinite',
              flexShrink: 0,
            }}
          />
          <div>
            <p
              style={{
                margin: 0,
                fontSize: '13px',
                fontWeight: '500',
                color: 'rgb(30, 58, 138)',
              }}
            >
              {getStepDescription()}
            </p>
            <p
              style={{
                margin: '4px 0 0 0',
                fontSize: '12px',
                color: 'rgb(71, 85, 180)',
              }}
            >
              {analysisStep === 'analyzing' && 'Extracting design elements...'}
              {analysisStep === 'sending' && 'Waiting for AI response...'}
              {analysisStep === 'processing' && 'Generating code...'}
            </p>
          </div>
          <style>
            {`
              @keyframes spin {
                to {
                  transform: rotate(360deg);
                }
              }
            `}
          </style>
        </div>
      )}

      {/* Analyze Button */}
      <button
        onClick={handleAnalyze}
        disabled={isAnalyzing || !designPrompt.trim()}
        className="vc-design-analyzer-btn"
        style={{
          width: '100%',
          padding: '12px 16px',
          border: 'none',
          borderRadius: '6px',
          background:
            isAnalyzing || !designPrompt.trim()
              ? 'rgb(209, 213, 219)'
              : 'linear-gradient(135deg, rgb(168, 85, 247), rgb(126, 34, 206))',
          color: 'white',
          fontSize: '14px',
          fontWeight: '600',
          cursor: isAnalyzing || !designPrompt.trim() ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
          boxShadow:
            !isAnalyzing && designPrompt.trim()
              ? '0 4px 12px rgba(168, 85, 247, 0.3)'
              : 'none',
          opacity: isAnalyzing || !designPrompt.trim() ? 0.7 : 1,
        }}
        onMouseEnter={(e) => {
          if (!isAnalyzing && designPrompt.trim()) {
            (e.target as HTMLButtonElement).style.boxShadow =
              '0 6px 16px rgba(168, 85, 247, 0.4)';
            (e.target as HTMLButtonElement).style.transform = 'translateY(-2px)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isAnalyzing && designPrompt.trim()) {
            (e.target as HTMLButtonElement).style.boxShadow =
              '0 4px 12px rgba(168, 85, 247, 0.3)';
            (e.target as HTMLButtonElement).style.transform = 'translateY(0)';
          }
        }}
        title={
          !designPrompt.trim()
            ? 'Please enter design instructions'
            : 'Analyze the design and generate code'
        }
      >
        {isAnalyzing ? 'Analyzing...' : 'Analyze Design'}
      </button>
    </div>
  );
};

export default DesignAnalyzer;
