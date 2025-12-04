import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

export const WelcomeScreen = ({ onComplete }: { onComplete: () => void }) => {
    const [text, setText] = useState('Hello');

    useEffect(() => {
        // Lock body scroll
        document.body.style.overflow = 'hidden';

        // Sequence timing
        const timer1 = setTimeout(() => {
            setText('I am Adnan Ashraf');
        }, 2000); // Change text after 2 seconds

        const timer2 = setTimeout(() => {
            onComplete(); // Signal completion to parent
            document.body.style.overflow = 'unset'; // Unlock scroll
        }, 4500); // End total animation after 4.5 seconds

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
            document.body.style.overflow = 'unset';
        };
    }, [onComplete]);

    return (
        <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black text-white"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, y: -50 }} // Slide up/fade out effect
            transition={{ duration: 0.8, ease: "easeInOut" }}
        >
            <AnimatePresence mode="wait">
                <motion.h1
                    key={text}
                    initial={{ opacity: 0, y: 10, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -10, filter: 'blur(10px)' }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="text-4xl md:text-7xl font-bold tracking-tighter text-center px-4"
                >
                    {text}
                </motion.h1>
            </AnimatePresence>
        </motion.div>
    );
};
