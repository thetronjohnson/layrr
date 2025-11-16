interface ElementInspectorProps {
  selectedElement: {
    tagName: string;
    classes: string[];
    id: string;
    selector: string;
    bounds: {
      width: number;
      height: number;
      x: number;
      y: number;
    };
  } | null;
}

export default function ElementInspector({ selectedElement }: ElementInspectorProps) {
  if (!selectedElement) {
    return (
      <div className="bg-white rounded-lg p-4 border border">
        <p className="text-sm text-gray-600 text-center">
          No element selected. Click "Select Element" to inspect an element.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-4 border border space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Element Inspector</h3>
        <span className="text-xs text-gray-600">{selectedElement.tagName}</span>
      </div>

      {/* Tag Name */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-700">Tag</label>
        <div className="bg-primary rounded px-3 py-2">
          <code className="text-sm text-purple-600 font-mono">
            &lt;{selectedElement.tagName.toLowerCase()}&gt;
          </code>
        </div>
      </div>

      {/* ID */}
      {selectedElement.id && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-700">ID</label>
          <div className="bg-primary rounded px-3 py-2">
            <code className="text-sm text-blue-600 font-mono">
              #{selectedElement.id}
            </code>
          </div>
        </div>
      )}

      {/* Classes */}
      {selectedElement.classes.length > 0 && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-700">
            Classes ({selectedElement.classes.length})
          </label>
          <div className="bg-primary rounded px-3 py-2 max-h-32 overflow-y-auto">
            <div className="flex flex-wrap gap-1">
              {selectedElement.classes.map((cls, index) => (
                <span
                  key={index}
                  className="text-xs bg-white text-gray-700 px-2 py-0.5 rounded font-mono border border"
                >
                  .{cls}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CSS Selector */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-700">CSS Selector</label>
        <div className="bg-primary rounded px-3 py-2">
          <code className="text-sm text-green-600 font-mono break-all">
            {selectedElement.selector}
          </code>
        </div>
      </div>

      {/* Dimensions */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-700">Dimensions</label>
        <div className="bg-primary rounded px-3 py-2">
          <div className="grid grid-cols-2 gap-2 text-sm font-mono">
            <div>
              <span className="text-gray-600">W:</span>{' '}
              <span className="text-gray-900">{Math.round(selectedElement.bounds.width)}px</span>
            </div>
            <div>
              <span className="text-gray-600">H:</span>{' '}
              <span className="text-gray-900">{Math.round(selectedElement.bounds.height)}px</span>
            </div>
            <div>
              <span className="text-gray-600">X:</span>{' '}
              <span className="text-gray-900">{Math.round(selectedElement.bounds.x)}px</span>
            </div>
            <div>
              <span className="text-gray-600">Y:</span>{' '}
              <span className="text-gray-900">{Math.round(selectedElement.bounds.y)}px</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
