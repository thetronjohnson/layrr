# Image Attachment Feature Documentation

## Overview

Layrr now supports attaching actual image files to your Next.js project. This is different from the existing "design analysis" feature where Claude recreates a design in code. With image attachment, the actual image file is copied to your project's `public/images/` directory and referenced in the generated code.

## Feature Highlights

✅ **Two distinct modes**:
- **📷 ImageIcon button**: Analyze design images (Claude recreates the design in code)
- **📎 Paperclip button**: Attach images to project (Claude references the actual file)

✅ **Smart file management**:
- Images automatically copied to `public/images/` directory
- Unique filenames with timestamps to avoid conflicts
- 5MB size limit for attachments
- Supports JPEG, PNG, WebP, GIF, SVG

✅ **Next.js integration**:
- Automatically uses Next.js `<Image>` component
- Proper path references (`/images/filename.jpg`)
- Framework detection ensures compatibility

✅ **Visual feedback**:
- Purple border for design analysis images
- Blue border for attachment images
- Clear labels distinguish the two modes

## How It Works

### User Flow

1. **Click Paperclip button** in the chat input
2. **Select an image** from your file system
3. **See preview** with blue border labeled "Image to attach"
4. **Type instruction**: "Add this hero image to the homepage"
5. **Press Send**
6. **Image is copied** to `public/images/1732241234-image.jpg`
7. **Claude generates code** using the image path
8. **Result**: Your image appears on the site with proper Next.js Image component

### Technical Flow

```
User selects image
    ↓
Frontend (ChatInput.tsx)
- File size validation (5MB limit)
- Base64 encoding
- Preview with blue border
    ↓
User clicks send
    ↓
Frontend (App.tsx)
- Detects isAttachment flag
- Sends attach-image message type
    ↓
postMessage → Iframe → WebSocket
    ↓
Backend (pkg/proxy/server.go)
- Receives attach-image message
- Validates project is Next.js
- Calls SaveImageToProject()
    ↓
Backend (pkg/proxy/imagehandler.go)
- Creates public/images/ directory
- Generates unique filename
- Decodes base64 and writes file
- Returns path: /images/1732241234-image.jpg
    ↓
Backend formats instruction for Claude:
"User said: Add this hero image
Image saved at: /images/1732241234-image.jpg
Use Next.js Image component with this path"
    ↓
Claude Code generates:
import Image from 'next/image'
<Image src="/images/1732241234-image.jpg" width={800} height={600} alt="Hero" />
    ↓
File watcher detects changes → Browser reloads
    ↓
User sees their image on the page!
```

## Files Created/Modified

### New Files

**1. `pkg/proxy/imagehandler.go`**
- `SaveImageToProject()` - Main function to save images
- `ensurePublicImagesDir()` - Creates directory if needed
- `generateUniqueFilename()` - Timestamp-based filenames
- `getImageExtension()` - MIME type to extension conversion
- `ValidateImageType()` - Supported format validation

### Modified Files

**2. `pkg/proxy/server.go`**
- Added `case "attach-image"` in WebSocket message handler
- Added `handleImageAttachment()` function (~130 lines)
- Project type validation (Next.js only)
- Image saving and path management
- Claude Code instruction formatting

**3. `inject-react/src/minimal-inject.tsx`**
- Added `case 'SEND_ATTACHMENT_MESSAGE'` in handleMessage
- WebSocket forwarding for attachment messages

**4. `frontend/src/components/ChatInput.tsx`**
- Added `Paperclip` to imports from Phosphor Icons
- Added `attachedImage` state
- Added `attachmentInputRef` ref
- Added `handleAttachmentSelect()` handler
- Added attachment preview with blue border
- Added Paperclip button UI
- Updated `handleSubmit()` to support attachments
- Updated Props interface with `isAttachment` parameter

**5. `frontend/src/App.tsx`**
- Updated `handleSubmitPrompt()` signature: added `isAttachment` parameter
- Added attachment flow handling
- Added `SEND_ATTACHMENT_MESSAGE` postMessage type
- Message history tracking for attachments

## API Reference

### Frontend API

#### ChatInput Component

```typescript
interface ChatInputProps {
  // ... other props
  onSubmitPrompt: (
    prompt: string,
    image?: string | null,
    isAttachment?: boolean  // NEW: Distinguishes attachment from design analysis
  ) => void;
}
```

### Backend API

#### WebSocket Message Format

**Attach Image Message:**
```json
{
  "type": "attach-image",
  "id": 1732241234567,
  "image": "base64-encoded-image-data",
  "imageType": "image/jpeg",
  "prompt": "Add this hero image to the homepage"
}
```

**Response (Success):**
```json
{
  "id": 1732241234567,
  "status": "complete",
  "imagePath": "/images/1732241234-image.jpg"
}
```

**Response (Error):**
```json
{
  "id": 1732241234567,
  "status": "error",
  "error": "image attachment is currently only supported for Next.js projects",
  "savedPath": "/images/1732241234-image.jpg"  // Still included even on error
}
```

#### Go Functions

**SaveImageToProject:**
```go
func SaveImageToProject(imageBase64, imageType, projectDir string) (string, error)
```

Parameters:
- `imageBase64`: Base64-encoded image data (without data URL prefix)
- `imageType`: MIME type (e.g., "image/jpeg")
- `projectDir`: Absolute path to project root

Returns:
- `string`: Relative path for use in code (e.g., "/images/1732241234-image.jpg")
- `error`: Error if operation fails

**ValidateImageType:**
```go
func ValidateImageType(mimeType string) bool
```

Supported types:
- `image/jpeg`, `image/jpg`
- `image/png`
- `image/webp`
- `image/gif`
- `image/svg+xml`, `image/svg`

## Usage Examples

### Example 1: Adding a Logo

**User action:**
1. Click Paperclip button
2. Select `company-logo.png`
3. Type: "Add this logo to the navigation bar"
4. Click Send

**Result:**
```tsx
import Image from 'next/image'
import Link from 'next/link'

export default function Navigation() {
  return (
    <nav className="flex items-center justify-between p-4">
      <Image
        src="/images/1732241234-image.png"
        width={120}
        height={40}
        alt="Company Logo"
      />
      {/* ... rest of navigation */}
    </nav>
  )
}
```

File created: `public/images/1732241234-image.png`

### Example 2: Hero Section Background

**User action:**
1. Select hero section element
2. Click Paperclip button
3. Select `hero-background.jpg`
4. Type: "Use this as the background image"
5. Click Send

**Result:**
```tsx
<div className="relative h-screen">
  <Image
    src="/images/1732241235-image.jpg"
    fill
    className="object-cover"
    alt="Hero background"
  />
  <div className="relative z-10">
    {/* Hero content */}
  </div>
</div>
```

File created: `public/images/1732241235-image.jpg`

### Example 3: Product Photo

**User action:**
1. Select product card
2. Click Paperclip button
3. Select `product-photo.jpg`
4. Type: "Replace the placeholder with this product image"
5. Click Send

**Result:**
```tsx
<div className="rounded-lg overflow-hidden">
  <Image
    src="/images/1732241236-image.jpg"
    width={400}
    height={400}
    alt="Product photo"
    className="object-cover"
  />
  <div className="p-4">
    {/* Product details */}
  </div>
</div>
```

File created: `public/images/1732241236-image.jpg`

## Error Handling

### Common Errors and Solutions

**Error: "image attachment is currently only supported for Next.js projects"**

*Cause:* Project is not detected as Next.js

*Solution:*
- Ensure project has `"next"` in `package.json` dependencies
- Check that project has either `app/` or `pages/` directory
- Restart Layrr to refresh project detection

**Error: "Image must be less than 5MB for attachments"**

*Cause:* Selected file exceeds size limit

*Solution:*
- Use image compression tools to reduce file size
- Use WebP format for better compression
- Consider using design analysis mode instead (no size limit)

**Error: "missing or invalid image data"**

*Cause:* Image failed to encode or transmit

*Solution:*
- Try selecting the image again
- Check browser console for errors
- Ensure image format is supported

**Error: "failed to create images directory"**

*Cause:* Permission issues or invalid project path

*Solution:*
- Check write permissions in project directory
- Ensure `public/` directory exists
- Verify project path is correct

## Design Analysis vs Attachment

### When to Use Design Analysis (ImageIcon 📷)

Use this when you have:
- **Design mockups** from Figma/Sketch/etc.
- **Screenshots** of desired UI
- **Reference designs** to recreate
- **Wireframes** to implement

Claude will:
- Analyze the design visually
- Generate new code from scratch
- Recreate colors, spacing, typography
- Not save the original image file

### When to Use Attachment (Paperclip 📎)

Use this when you have:
- **Product photos** to display
- **Brand logos** to place
- **User avatars** to show
- **Hero images** for backgrounds
- **Icons or illustrations** to include

Claude will:
- Copy the image to `public/images/`
- Reference the actual file in code
- Use Next.js Image component
- Preserve the original image

## Visual Indicators

### Design Analysis Preview
```
┌─────────────────────────────┐
│ Design to analyze           │ ← Purple text
├─────────────────────────────┤
│                             │
│   [Image Preview]           │ ← Purple border
│                             │
└─────────────────────────────┘
```

### Attachment Preview
```
┌─────────────────────────────┐
│ Image to attach             │ ← Blue text
├─────────────────────────────┤
│                             │
│   [Image Preview]           │ ← Blue border
│                             │
└─────────────────────────────┘
```

## Limitations

### Current Limitations

1. **Next.js Only**: Currently only works with Next.js projects
   - React, Vue, Svelte support planned for future

2. **5MB Size Limit**: Attachments limited to 5MB
   - Design analysis has no size limit
   - Consider image compression for large files

3. **Single Directory**: Images saved to `public/images/` only
   - Future: support for custom directories
   - Future: auto-detect existing patterns

4. **No Filename Preservation**: Original filename not preserved
   - Timestamps used to prevent conflicts
   - Future: option to preserve original names

5. **No Image Optimization**: Images saved as-is
   - Future: auto-optimization (resize, compress)
   - Future: WebP conversion option

## Future Enhancements

### Planned Features

- [ ] **React Support**: Save to `public/` root for React projects
- [ ] **Vue Support**: Save to `public/` root for Vue projects
- [ ] **Custom Directories**: Allow user to choose save location
- [ ] **Filename Preservation**: Option to keep original filename
- [ ] **Auto-optimization**: Automatic image compression
- [ ] **WebP Conversion**: Convert to WebP for better performance
- [ ] **Batch Upload**: Attach multiple images at once
- [ ] **Image Gallery**: View all attached images in project
- [ ] **Smart Suggestions**: Suggest appropriate sizes based on usage
- [ ] **Alt Text Generation**: AI-generated alt text for accessibility

## Troubleshooting

### Image Not Showing After Attachment

**Check:**
1. Is Next.js dev server running?
2. Did the file copy succeed? (check `public/images/` directory)
3. Does the path in code match the saved file?
4. Any console errors in browser?

**Try:**
- Refresh the page manually
- Check file permissions
- Verify Next.js is configured correctly

### Paperclip Button Disabled

**Cause:** Usually happens when processing another request

**Solution:**
- Wait for current operation to complete
- Check if design analysis is still running
- Restart Layrr if button stays disabled

### Wrong Image Used

**Symptom:** Claude uses a different image than intended

**Cause:** Both design analysis and attachment images selected

**Solution:**
- Clear one preview before sending
- Click the × button to remove unwanted image
- Only one type of image should be active at a time

## Summary

The image attachment feature provides a powerful way to add real images to your Next.js project through natural language instructions. By distinguishing between design analysis and file attachment, Layrr gives you the flexibility to either recreate designs in code or use actual image assets.

**Key Benefits:**
- ✅ Simple UX with clear visual feedback
- ✅ Automatic file management
- ✅ Next.js-native implementation
- ✅ Safe with size limits and validation
- ✅ Non-developers can add images without touching code

This feature is production-ready and fully integrated into the Layrr workflow!
