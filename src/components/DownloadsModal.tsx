import React, { useEffect } from 'react';
import { X, Download, Gift } from 'lucide-react';
import petImg from '../assets/echobot/downloads/pet.webp';
import stickersImg from '../assets/echobot/downloads/stickers.webp';
import wallpapersImg from '../assets/echobot/downloads/wallpapers.webp';
import printImg from '../assets/echobot/downloads/print.webp';
import arImg from '../assets/echobot/downloads/ar.webp';

interface DownloadsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/** Files live as assets on the "pet-v1" GitHub release, so the site repo stays free of binaries. */
const RELEASE = 'https://github.com/aaadnan259/EchobotVoiceAssistant/releases/download/pet-v1/';

export interface DownloadItem {
    id: string;
    title: string;
    blurb: string;
    file: string;
    meta: string;
    img: string;
}

export const DOWNLOADS: DownloadItem[] = [
    {
        id: 'pet',
        title: 'Desktop pet',
        blurb: 'EchoBot lives on your screen: sits on your windows, bobs to music, keeps you company while you work and chats for free.',
        file: 'EchoBot-Pet.exe',
        meta: 'Windows · 7.5 MB',
        img: petImg,
    },
    {
        id: 'stickers',
        title: 'Sticker pack',
        blurb: 'Animated moods for Telegram, WhatsApp and Discord, plus emoji and still stickers.',
        file: 'EchoBot-Stickers.zip',
        meta: 'ZIP',
        img: stickersImg,
    },
    {
        id: 'wallpapers',
        title: 'Wallpapers',
        blurb: 'A high-resolution EchoBot render and the full sticker sheet.',
        file: 'EchoBot-Wallpapers.zip',
        meta: 'ZIP',
        img: wallpapersImg,
    },
    {
        id: 'print',
        title: '3D print',
        blurb: 'A 60 mm desk figure with separate eyes. Print the body in purple and the eyes in black.',
        file: 'EchoBot-3D-Print.zip',
        meta: 'STL files',
        img: printImg,
    },
    {
        id: 'ar',
        title: 'EchoBot in AR',
        blurb: 'Open on an iPhone or iPad and tap AR to put EchoBot on your table.',
        file: 'EchoBot-AR.usdz',
        meta: 'iPhone / iPad',
        img: arImg,
    },
];

export const DownloadsModal: React.FC<DownloadsModalProps> = ({ isOpen, onClose }) => {
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-2xl bg-white dark:bg-[#1C1F2E] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden"
                role="dialog"
                aria-modal="true"
                aria-labelledby="downloads-title"
                data-testid="downloads-modal"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-5 sm:p-6 border-b border-gray-100 dark:border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500">
                            <Gift size={20} />
                        </div>
                        <div>
                            <h2 id="downloads-title" className="text-xl font-semibold text-gray-900 dark:text-white">Take EchoBot with you</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Free downloads</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        aria-label="Close downloads"
                    >
                        <X size={20} />
                    </button>
                </div>

                <ul className="p-4 sm:p-6 max-h-[70vh] overflow-y-auto grid gap-3">
                    {DOWNLOADS.map((d) => (
                        <li
                            key={d.id}
                            className="flex items-center gap-4 p-3 sm:p-4 rounded-xl border border-gray-100 dark:border-white/10 bg-gray-50/60 dark:bg-white/5"
                        >
                            <img src={d.img} alt="" className="w-14 h-14 sm:w-16 sm:h-16 object-contain flex-none" />
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-baseline gap-x-2">
                                    <h3 className="font-semibold text-gray-900 dark:text-white">{d.title}</h3>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">{d.meta}</span>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">{d.blurb}</p>
                            </div>
                            <a
                                href={RELEASE + d.file}
                                download
                                className="flex-none inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors"
                                aria-label={`Download ${d.title}`}
                            >
                                <Download size={16} />
                                <span className="hidden sm:inline">Download</span>
                            </a>
                        </li>
                    ))}
                </ul>

                <div className="px-5 sm:px-6 py-4 bg-gray-50 dark:bg-white/5 border-t border-gray-100 dark:border-white/5 text-sm text-gray-500 dark:text-gray-400">
                    Desktop pet: the first time you open it, Windows may say "Windows protected your PC". Click <b>More info</b>, then <b>Run anyway</b>.
                </div>
            </div>
        </div>
    );
};

export default DownloadsModal;
