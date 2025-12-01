import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileUpload } from './components/FileUpload';
import { RateConfig } from './components/RateConfig';
import { Dashboard } from './components/Dashboard';
import { parseSchedule, type ArbitratorStats } from './utils/parser';
import { Loader2 } from 'lucide-react';

function App() {
  const [step, setStep] = useState<'upload' | 'config' | 'dashboard'>('upload');
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<{
    arbitrators: ArbitratorStats[];
    categories: string[];
  } | null>(null);
  const [rates, setRates] = useState<Record<string, number>>({});

  const getDefaultRate = (category: string): number => {
    // Extract number from category (e.g., "12u" -> 12)
    const match = category.match(/(\d+)/);
    if (!match) return 0;

    const num = parseInt(match[1]);

    if (num >= 6 && num <= 8) return 25;
    if (num >= 9 && num <= 11) return 27;
    if (num >= 12 && num <= 14) return 29;
    if (num >= 15 && num <= 16) return 30;
    if (num >= 17 && num <= 19) return 35;

    return 0;
  };

  const handleFileSelect = async (file: File) => {
    setIsLoading(true);
    try {
      // Simulate a small delay for better UX (to show loading state)
      await new Promise(resolve => setTimeout(resolve, 800));
      const result = await parseSchedule(file);

      // Calculate default rates
      const initialRates: Record<string, number> = {};
      result.allCategories.forEach(cat => {
        initialRates[cat] = getDefaultRate(cat);
      });

      setData({
        arbitrators: result.arbitrators,
        categories: result.allCategories
      });
      setRates(initialRates);
      setStep('dashboard'); // Skip config step
    } catch (error) {
      console.error("Error parsing file:", error);
      alert("Error parsing file. Please check the format.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRateChange = (category: string, newRate: number) => {
    setRates(prev => ({
      ...prev,
      [category]: newRate
    }));
  };

  const handleRateConfirm = (newRates: Record<string, number>) => {
    setRates(newRates);
    setStep('dashboard');
  };

  const handleReset = () => {
    setStep('upload');
    setData(null);
    setRates({});
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-primary-100 selection:text-primary-700">
      {/* Background decoration */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-200/20 rounded-full blur-3xl mix-blend-multiply animate-blob" />
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-200/20 rounded-full blur-3xl mix-blend-multiply animate-blob animation-delay-2000" />
        <div className="absolute -bottom-8 left-1/3 w-96 h-96 bg-pink-200/20 rounded-full blur-3xl mix-blend-multiply animate-blob animation-delay-4000" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12">
        <header className="text-center mb-16">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-4"
          >
            Referee<span className="text-primary-600">Pay</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-slate-600 max-w-2xl mx-auto"
          >
            Automated payroll processing for sports officials. Upload your schedule, set rates, and get paid.
          </motion.p>
        </header>

        <main className="flex flex-col items-center justify-center min-h-[400px]">
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-4"
              >
                <Loader2 className="w-12 h-12 text-primary-500 animate-spin" />
                <p className="text-slate-500 font-medium">Processing schedule...</p>
              </motion.div>
            ) : step === 'upload' ? (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full"
              >
                <FileUpload onFileSelect={handleFileSelect} />
              </motion.div>
            ) : step === 'config' && data ? (
              <motion.div
                key="config"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-full"
              >
                <RateConfig
                  categories={data.categories}
                  onConfirm={handleRateConfirm}
                  initialRates={rates}
                />
              </motion.div>
            ) : step === 'dashboard' && data ? (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="w-full"
              >
                <Dashboard
                  arbitrators={data.arbitrators}
                  categories={data.categories}
                  rates={rates}
                  onRateChange={handleRateChange}
                  onReset={handleReset}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </main>

        <footer className="mt-20 text-center text-slate-400 text-sm">
          <p>&copy; {new Date().getFullYear()} Coquitech AI Agency. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
