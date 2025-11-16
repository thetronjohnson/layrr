import type { StateCreator } from 'zustand';
import type { LayyrrStore } from './index';

export interface DesignSlice {
  showDesignModal: boolean;
  uploadedImage: string | null;
  uploadedImageType: string;
  imagePreview: string;
  designPrompt: string;
  isAnalyzing: boolean;
  analysisError: string;
  analysisStep: '' | 'analyzing' | 'sending' | 'processing';
  currentDesignMessageId: number | null;

  // Actions
  toggleDesignModal: () => void;
  setUploadedImage: (image: string, type: string) => void;
  setDesignPrompt: (prompt: string) => void;
  startAnalysis: () => void;
  setAnalysisStep: (step: DesignSlice['analysisStep']) => void;
  setAnalysisError: (error: string) => void;
  completeAnalysis: () => void;
  resetDesignUpload: () => void;
}

export const createDesignSlice: StateCreator<
  LayyrrStore,
  [],
  [],
  DesignSlice
> = (set, get) => ({
  showDesignModal: false,
  uploadedImage: null,
  uploadedImageType: '',
  imagePreview: '',
  designPrompt: '',
  isAnalyzing: false,
  analysisError: '',
  analysisStep: '',
  currentDesignMessageId: null,

  toggleDesignModal: () => {
    set((state) => ({
      showDesignModal: !state.showDesignModal,
    }));
  },

  setUploadedImage: (image, type) => {
    set({
      uploadedImage: image,
      uploadedImageType: type,
      imagePreview: image,
      analysisError: '',
    });
  },

  setDesignPrompt: (prompt) => {
    set({ designPrompt: prompt });
  },

  startAnalysis: () => {
    const messageId = get().incrementMessageId();
    set({
      isAnalyzing: true,
      analysisStep: 'analyzing',
      analysisError: '',
      currentDesignMessageId: messageId,
    });
  },

  setAnalysisStep: (step) => {
    set({ analysisStep: step });
  },

  setAnalysisError: (error) => {
    set({
      analysisError: error,
      isAnalyzing: false,
      analysisStep: '',
    });
  },

  completeAnalysis: () => {
    set({
      isAnalyzing: false,
      analysisStep: '',
      showDesignModal: false,
    });

    // Reset after a delay
    setTimeout(() => {
      get().resetDesignUpload();
    }, 1000);
  },

  resetDesignUpload: () => {
    set({
      uploadedImage: null,
      uploadedImageType: '',
      imagePreview: '',
      designPrompt: '',
      isAnalyzing: false,
      analysisError: '',
      analysisStep: '',
      currentDesignMessageId: null,
    });
  },
});
