import { useState, useCallback } from 'react';
import { toast } from 'sonner';

const MAX_IMAGES = 4;
const MAX_SIZE_MB = 10;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function useImageInput(initialImages: string[] = []) {
    const [images, setImages] = useState<string[]>(initialImages);

    const validateFile = (file: File): boolean => {
        if (!ALLOWED_TYPES.includes(file.type)) {
            toast.error(`Invalid file type: ${file.name}. Only JPEG, PNG, WEBP, and GIF are allowed.`);
            return false;
        }
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
            toast.error(`File too large: ${file.name}. Max size is ${MAX_SIZE_MB}MB.`);
            return false;
        }
        return true;
    };

    const processFiles = useCallback(async (files: File[]) => {
        if (images.length + files.length > MAX_IMAGES) {
            toast.error(`You can only upload up to ${MAX_IMAGES} images.`);
            return;
        }

        const validFiles = files.filter(validateFile);

        if (validFiles.length === 0) return;

        const promises = validFiles.map(file => {
            return new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    if (reader.result) resolve(reader.result as string);
                    else reject(new Error('Failed to read file'));
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        });

        try {
            const results = await Promise.all(promises);
            setImages(prev => [...prev, ...results]);
        } catch (error) {
            console.error("Error processing images:", error);
            toast.error("Failed to process some images.");
        }
    }, [images.length]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            processFiles(Array.from(e.target.files));
        }
        // Reset inputs value to allow selecting same file again if needed
        e.target.value = '';
    }, [processFiles]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files) {
            processFiles(Array.from(e.dataTransfer.files));
        }
    }, [processFiles]);

    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        const files: File[] = [];

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
                const file = items[i].getAsFile();
                if (file) files.push(file);
            }
        }

        if (files.length > 0) {
            e.preventDefault(); // Prevent pasting the file name or default binary dump
            processFiles(files);
        }
    }, [processFiles]);

    const removeImage = useCallback((index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    }, []);

    const clearImages = useCallback(() => {
        setImages([]);
    }, []);

    return {
        images,
        handleFileSelect,
        handleDrop,
        handlePaste,
        removeImage,
        clearImages,
        hasImages: images.length > 0,
        isMaxReached: images.length >= MAX_IMAGES
    };
}
