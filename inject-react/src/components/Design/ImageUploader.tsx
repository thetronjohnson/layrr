import React, { useRef, useState } from 'react';
import { useLayyrrStore } from '../../store';

/**
 * ImageUploader component
 * File upload interface with drag & drop and preview
 * - Drag & drop area for image files
 * - File input button for manual selection
 * - Image preview with file details
 * - Accepts: PNG, JPEG, JPG formats
 * - Converts to base64 for processing
 */
const ImageUploader: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { setUploadedImage, uploadedImage, imagePreview } = useLayyrrStore();

  /**
   * Convert file to base64 string
   */
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  /**
   * Handle file selection and conversion
   */
  const handleFileSelect = async (file: File) => {
    // Validate file type
    const acceptedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!acceptedTypes.includes(file.type)) {
      console.error('Invalid file type. Please upload PNG, JPEG, or JPG.');
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      setUploadedImage(base64, file.type);
    } catch (error) {
      console.error('Error converting file to base64:', error);
    }
  };

  /**
   * Handle drag over event
   */
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  /**
   * Handle drag leave event
   */
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  /**
   * Handle drop event
   */
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  /**
   * Handle file input change
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  /**
   * Trigger file input click
   */
  const handleClick = () => {
    fileInputRef.current?.click();
  };

  /**
   * Format file size for display
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  // For file size display, we'll estimate based on base64 length
  const estimatedFileSize = uploadedImage
    ? Math.round((uploadedImage.length * 3) / 4)
    : 0;

  return (
    <div className="vc-image-uploader">
      {!uploadedImage ? (
        <div
          className="vc-image-uploader-dropzone"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
          style={{
            border: isDragging
              ? '2px dashed rgb(168, 85, 247)'
              : '2px dashed rgb(209, 213, 219)',
            borderRadius: '10px',
            padding: '40px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
            background: isDragging
              ? 'rgba(168, 85, 247, 0.05)'
              : 'rgb(249, 250, 251)',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLDivElement;
            if (!isDragging) {
              el.style.borderColor = 'rgb(168, 85, 247)';
              el.style.background = 'rgba(168, 85, 247, 0.02)';
            }
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLDivElement;
            if (!isDragging) {
              el.style.borderColor = 'rgb(209, 213, 219)';
              el.style.background = 'rgb(249, 250, 251)';
            }
          }}
        >
          <div style={{ marginBottom: '12px', fontSize: '32px' }}>📁</div>
          <h3
            style={{
              margin: '0 0 8px 0',
              fontSize: '16px',
              fontWeight: '600',
              color: 'rgb(31, 41, 55)',
            }}
          >
            Drop your design here
          </h3>
          <p
            style={{
              margin: '0 0 16px 0',
              fontSize: '14px',
              color: 'rgb(107, 114, 128)',
            }}
          >
            or click to browse
          </p>
          <p
            style={{
              margin: 0,
              fontSize: '12px',
              color: 'rgb(156, 163, 175)',
            }}
          >
            PNG, JPEG, JPG up to 10MB
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            onChange={handleInputChange}
            style={{ display: 'none' }}
            data-testid="design-file-input"
          />
        </div>
      ) : (
        <div
          className="vc-image-uploader-preview"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* Preview Image */}
          <div
            style={{
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid rgb(229, 231, 235)',
              background: 'rgb(249, 250, 251)',
              maxHeight: '300px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src={imagePreview}
              alt="Design preview"
              style={{
                maxWidth: '100%',
                maxHeight: '300px',
                objectFit: 'contain',
              }}
            />
          </div>

          {/* File Info */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px',
              background: 'rgb(249, 250, 251)',
              borderRadius: '8px',
              border: '1px solid rgb(229, 231, 235)',
            }}
          >
            <div>
              <p
                style={{
                  margin: '0 0 4px 0',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: 'rgb(31, 41, 55)',
                }}
              >
                File uploaded
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: '12px',
                  color: 'rgb(107, 114, 128)',
                }}
              >
                {formatFileSize(estimatedFileSize)}
              </p>
            </div>
            <button
              onClick={handleClick}
              className="vc-image-uploader-change-btn"
              style={{
                padding: '8px 16px',
                border: '1px solid rgb(229, 231, 235)',
                borderRadius: '6px',
                background: 'white',
                color: 'rgb(75, 85, 99)',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.background = 'rgb(243, 244, 246)';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.background = 'white';
              }}
            >
              Change
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
