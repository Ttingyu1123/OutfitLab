
import React, { useRef, useState, useEffect } from 'react';

interface ImageUploaderProps {
  onImageSelected: (base64: string) => void;
  currentImage?: string | null; // Controlled state from parent
  label?: string;
  className?: string;
  aspectRatio?: string; // New prop to control aspect ratio class
  dragText?: string;
  changeText?: string;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ 
  onImageSelected, 
  currentImage,
  label = "Upload Image", 
  className = "",
  aspectRatio = "aspect-[3/4]",
  dragText = "Click or drag photo",
  changeText = "Change Photo"
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync with external image state (e.g. Magic Edit updates)
  useEffect(() => {
    if (currentImage) {
      const src = currentImage.startsWith('data:') 
        ? currentImage 
        : `data:image/jpeg;base64,${currentImage}`;
      setPreview(src);
    }
  }, [currentImage]);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      const base64Data = result.split(',')[1];
      setPreview(result);
      onImageSelected(base64Data);
    };
    reader.readAsDataURL(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  return (
    <div 
      className={`relative group cursor-pointer transition-all duration-300 ${className}`}
      onClick={() => inputRef.current?.click()}
    >
      <input 
        type="file" 
        ref={inputRef} 
        onChange={onChange} 
        accept="image/*" 
        className="hidden" 
      />
      
      <div 
        className={`
          w-full ${aspectRatio} rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-4 overflow-hidden shadow-inner-light
          ${isDragging 
            ? 'border-brand-500 bg-brand-50' 
            : 'border-slate-300 bg-input hover:border-brand-400 hover:bg-white'
          }
        `}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {preview ? (
          <img src={preview} alt="Preview" className="w-full h-full object-cover rounded-xl" />
        ) : (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-slate-200/50 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform text-slate-400 group-hover:text-brand-500">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-600">{label}</p>
              <p className="text-sm text-slate-400">{dragText}</p>
            </div>
          </div>
        )}
        
        {preview && (
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-2xl backdrop-blur-[1px]">
            <div className="bg-white/90 text-slate-800 px-4 py-2 rounded-full text-sm font-medium shadow-lg">
              {changeText}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageUploader;

