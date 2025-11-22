import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Upload, Check } from '@phosphor-icons/react';
import { motion } from 'framer-motion';

interface ImageInfo {
  path: string;
  name: string;
  size: number;
}

interface ImageGalleryProps {
  onBack: () => void;
  onSelectImage: (path: string) => void;
  selectedImagePath?: string | null;
  isReplacementMode?: boolean;
  currentImagePath?: string | null;
  onReplaceImage?: (newPath: string) => void;
}

export default function ImageGallery({
  onBack,
  onSelectImage,
  selectedImagePath,
  isReplacementMode = false,
  currentImagePath,
  onReplaceImage
}: ImageGalleryProps) {
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load images when component mounts
  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:9998/__layrr/list-images');
      if (!response.ok) {
        throw new Error('Failed to load images');
      }
      const data = await response.json();
      console.log('[ImageGallery] Loaded images:', data);
      setImages(data || []);
    } catch (error) {
      console.error('[ImageGallery] Failed to load images:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB');
      return;
    }

    setIsUploading(true);

    try {
      // Read file as base64
      const reader = new FileReader();

      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        const imageTypeMatch = dataUrl.match(/data:(image\/[^;]+);base64,/);
        const imageType = imageTypeMatch ? imageTypeMatch[1] : 'image/png';
        const base64Data = dataUrl.replace(/^data:image\/[^;]+;base64,/, '');

        try {
          // Upload to backend
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

          console.log('[ImageGallery] Image uploaded successfully');

          // Reload images to show the new one
          await loadImages();

          // Reset file input
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        } catch (error) {
          console.error('[ImageGallery] Failed to upload image:', error);
          alert(`Failed to upload image: ${error}`);
        } finally {
          setIsUploading(false);
        }
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('[ImageGallery] Failed to read file:', error);
      alert('Failed to read image file');
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with Back Button */}
      <div className="flex flex-col p-4 border-b">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1 rounded-md hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={20} weight="bold" />
          </button>
          <h2 className="text-lg font-semibold text-gray-900">
            {isReplacementMode ? 'Replace Image' : 'Image Gallery'}
          </h2>
        </div>
        {isReplacementMode && (
          <div className="mt-2 text-xs text-gray-500">
            Click on any image below to replace
          </div>
        )}
      </div>

      {/* Upload Button */}
      <div className="p-4 border-b">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Upload size={16} weight="bold" />
          {isUploading ? 'Uploading...' : 'Upload Image'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleUpload}
          className="hidden"
        />
      </div>

      {/* Images Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-black rounded-full"></div>
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <p className="text-sm">No images found</p>
            <p className="text-xs mt-1">Upload an image to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {images.map((image) => {
              const isCurrentImage = isReplacementMode && image.path === currentImagePath;

              return (
              <motion.div
                key={image.path}
                whileHover={{ scale: 1.02 }}
                className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                  isCurrentImage
                    ? 'border-green-500 shadow-lg cursor-not-allowed'
                    : selectedImagePath === image.path
                    ? 'border-blue-500 shadow-lg'
                    : isReplacementMode
                    ? 'border-gray-200 hover:border-purple-400 hover:shadow-lg cursor-pointer'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Image */}
                <div
                  className="aspect-square bg-gray-100 flex items-center justify-center cursor-pointer"
                  onClick={() => {
                    if (isReplacementMode) {
                      if (!isCurrentImage) {
                        onReplaceImage?.(image.path);
                      }
                    } else {
                      onSelectImage(image.path);
                    }
                  }}
                >
                  <img
                    src={`http://localhost:9998${image.path}`}
                    alt={image.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.innerHTML = '<div class="text-gray-400 text-xs">Failed to load</div>';
                      }
                    }}
                  />
                </div>

                {/* Current Image Indicator */}
                {isCurrentImage && (
                  <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1">
                    <Check size={12} weight="bold" />
                  </div>
                )}

                {/* Selected Indicator */}
                {!isReplacementMode && selectedImagePath === image.path && (
                  <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
                    <Check size={12} weight="bold" />
                  </div>
                )}

                {/* Image Info */}
                <div className="p-2 bg-white">
                  <p className="text-xs font-medium text-gray-900 truncate" title={image.name}>
                    {image.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(image.size)}
                  </p>
                </div>
              </motion.div>
            );
            })}
          </div>
        )}
      </div>

      {/* Selected Image Path */}
      {selectedImagePath && (
        <div className="p-4 border-t bg-gray-50">
          <p className="text-xs text-gray-600 mb-1">Selected:</p>
          <p className="text-sm font-mono text-gray-900 bg-white px-2 py-1 rounded border break-all">
            {selectedImagePath}
          </p>
        </div>
      )}
    </div>
  );
}
