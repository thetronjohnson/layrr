import { Eye, PencilSimple, CursorClick } from '@phosphor-icons/react';

interface SelectionControlsProps {
  onSelectElement: () => void;
  isSelectionMode: boolean;
  isEditMode: boolean;
  onToggleEditMode: () => void;
}

export default function SelectionControls({
  onSelectElement,
  isSelectionMode,
  isEditMode,
  onToggleEditMode
}: SelectionControlsProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Edit/Browse Mode Toggle */}
      <div className="flex items-center justify-between bg-white rounded-lg p-3 border border">
        <div className="flex items-center gap-2">
          {isEditMode ? (
            <PencilSimple size={18} weight="bold" className="text-purple-600" />
          ) : (
            <Eye size={18} weight="bold" className="text-gray-600" />
          )}
          <span className="text-sm font-medium text-gray-900">
            {isEditMode ? 'Edit Mode' : 'Browse Mode'}
          </span>
        </div>
        <button
          onClick={onToggleEditMode}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
            isEditMode
              ? 'bg-gradient-purple text-white'
              : 'bg-button text-white hover:bg-button-hover'
          }`}
        >
          {isEditMode ? (
            <>
              <Eye size={14} weight="bold" />
              Browse
            </>
          ) : (
            <>
              <PencilSimple size={14} weight="bold" />
              Edit
            </>
          )}
        </button>
      </div>

      {/* Select Element Button */}
      {isEditMode && (
        <button
          onClick={onSelectElement}
          disabled={isSelectionMode}
          className={`w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
            isSelectionMode
              ? 'bg-green-600 text-white cursor-wait'
              : 'bg-gradient-purple text-white hover:-translate-y-0.5 hover:shadow-[0_10px_25px_rgba(102,126,234,0.3)]'
          }`}
        >
          <CursorClick size={20} weight="bold" />
          {isSelectionMode ? 'Click element in preview...' : 'Select Element'}
        </button>
      )}

      {/* Help Text */}
      {isEditMode && (
        <p className="text-xs text-slate-400 leading-relaxed">
          {isSelectionMode
            ? 'Hover over elements in the preview and click to select.'
            : 'Click "Select Element" then click on any element in your app to inspect and edit it.'}
        </p>
      )}
    </div>
  );
}
