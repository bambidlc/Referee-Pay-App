import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

interface FileUploadProps {
    onFileSelect: (file: File) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const validateAndProcessFile = (file: File) => {
        setError(null);
        const validTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel', // .xls
            'text/csv' // .csv
        ];

        // Some browsers might have empty type for csv/xlsx, so we check extension too
        const extension = file.name.split('.').pop()?.toLowerCase();
        const isValidExtension = ['xlsx', 'xls', 'csv'].includes(extension || '');

        if (validTypes.includes(file.type) || isValidExtension) {
            onFileSelect(file);
        } else {
            setError('Please upload a valid Excel (.xlsx, .xls) or CSV file.');
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            validateAndProcessFile(e.dataTransfer.files[0]);
        }
    }, [onFileSelect]);

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            validateAndProcessFile(e.target.files[0]);
        }
    };

    return (
        <div className="w-full max-w-xl mx-auto">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className={clsx(
                    "relative border-2 border-dashed rounded-3xl p-12 text-center transition-all duration-300 ease-in-out cursor-pointer overflow-hidden group",
                    isDragging
                        ? "border-primary-500 bg-primary-50/50 scale-[1.02] shadow-xl shadow-primary-500/10"
                        : "border-slate-200 hover:border-primary-400 hover:bg-slate-50"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-input')?.click()}
            >
                <input
                    type="file"
                    id="file-input"
                    className="hidden"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileInput}
                />

                <div className="relative z-10 flex flex-col items-center gap-4">
                    <div className={clsx(
                        "p-4 rounded-full transition-colors duration-300",
                        isDragging ? "bg-primary-100 text-primary-600" : "bg-slate-100 text-slate-400 group-hover:bg-primary-50 group-hover:text-primary-500"
                    )}>
                        {isDragging ? (
                            <FileSpreadsheet className="w-10 h-10 animate-bounce" />
                        ) : (
                            <Upload className="w-10 h-10" />
                        )}
                    </div>

                    <div>
                        <h3 className="text-xl font-semibold text-slate-800 mb-2">
                            {isDragging ? "Drop file here" : "Upload Schedule"}
                        </h3>
                        <p className="text-slate-500 text-sm max-w-xs mx-auto">
                            Drag and drop your Excel or CSV file here, or click to browse.
                        </p>
                    </div>
                </div>

                {/* Background Gradient Animation */}
                <div className={clsx(
                    "absolute inset-0 bg-gradient-to-br from-primary-500/5 to-purple-500/5 transition-opacity duration-500",
                    isDragging ? "opacity-100" : "opacity-0"
                )} />
            </motion.div>

            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-3 text-sm font-medium"
                    >
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        {error}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
