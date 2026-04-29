'use client';

import React, { useCallback, useState } from 'react';
import { Upload, X, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  maxSize?: number; // in MB
  accept?: string;
  multiple?: boolean;
  className?: string;
}

export function FileDropzone({
  onFilesSelected,
  maxFiles = 5,
  maxSize = 10,
  accept = '*/*',
  multiple = false,
  className,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const validateFiles = (files: File[]): { valid: File[]; error: string | null } => {
    // Check file count
    if (!multiple && files.length > 1) {
      return { valid: [], error: 'Solo se permite un archivo' };
    }

    if (files.length > maxFiles) {
      return { valid: [], error: `Máximo ${maxFiles} archivo(s) permitido(s)` };
    }

    // Check file size
    const oversizedFiles = files.filter((file) => file.size > maxSize * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      return { valid: [], error: `El tamaño máximo por archivo es ${maxSize}MB` };
    }

    // Check file type if accept is specified and not wildcard
    if (accept !== '*/*') {
      const acceptedTypes = accept.split(',').map((t) => t.trim());
      const invalidFiles = files.filter((file) => {
        const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
        const mimeType = file.type;
        return !acceptedTypes.some(
          (type) =>
            type === mimeType ||
            type === fileExtension ||
            (type.endsWith('/*') && mimeType.startsWith(type.replace('/*', '')))
        );
      });

      if (invalidFiles.length > 0) {
        return { valid: [], error: 'Tipo de archivo no permitido' };
      }
    }

    return { valid: files, error: null };
  };

  const handleFiles = (files: File[]) => {
    const { valid, error: validationError } = validateFiles(files);

    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSelectedFiles(valid);
    onFilesSelected(valid);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      handleFiles(files);
    },
    [maxFiles, maxSize, accept, multiple]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    handleFiles(files);
  };

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    onFilesSelected(newFiles);
    setError(null);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn(
          'relative border-2 border-dashed rounded-lg p-8 transition-colors',
          isDragging
            ? 'border-zinc-900 bg-zinc-50'
            : 'border-zinc-300 hover:border-zinc-400',
          error && 'border-red-500 bg-red-50'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
        />

        <label
          htmlFor="file-upload"
          className="flex flex-col items-center justify-center cursor-pointer"
        >
          <div
            className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-colors',
              isDragging ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-900'
            )}
          >
            <Upload className="h-6 w-6" />
          </div>

          <p className="text-sm font-medium mb-1">
            {isDragging ? 'Suelta aquí' : 'Arrastra archivos aquí'}
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            o haz clic para seleccionar
          </p>

          <div className="text-xs text-muted-foreground space-y-1 text-center">
            {accept !== '*/*' && (
              <p>
                Formatos:{' '}
                {accept
                  .split(',')
                  .map((t) => t.trim())
                  .join(', ')}
              </p>
            )}
            <p>
              Tamaño máximo: {maxSize}MB {multiple && `• Máximo ${maxFiles} archivos`}
            </p>
          </div>
        </label>
      </div>

      {error && (
        <p className="mt-2 text-sm text-destructive font-medium">{error}</p>
      )}

      {/* Selected Files List */}
      {selectedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium">
            Archivos seleccionados ({selectedFiles.length})
          </p>
          {selectedFiles.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card"
            >
              <div className="shrink-0 w-10 h-10 rounded bg-zinc-100 flex items-center justify-center">
                <FileText className="h-5 w-5 text-zinc-900" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => removeFile(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
