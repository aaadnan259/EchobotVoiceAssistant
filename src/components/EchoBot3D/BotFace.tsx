import React from 'react';
import logoFace from '../../assets/echobot/faces/logo.png';
import happyFace from '../../assets/echobot/faces/happy.png';
import talkingFace from '../../assets/echobot/faces/talking.png';
import sadFace from '../../assets/echobot/faces/sad.png';

/** Small still images of the 3D EchoBot, rendered from the same model as the big animated bot. */
export const BOT_FACES = {
    neutral: logoFace,
    happy: happyFace,
    talking: talkingFace,
    sad: sadFace,
} as const;

export type BotMood = keyof typeof BOT_FACES;

interface BotFaceProps {
    mood?: BotMood;
    /** Tailwind size + extra classes for the wrapper, e.g. "w-8 h-8". */
    className?: string;
    /** Accessible name; leave empty when the face is decorative. */
    label?: string;
}

export const BotFace: React.FC<BotFaceProps> = ({ mood = 'neutral', className = 'w-8 h-8', label }) => (
    <img
        src={BOT_FACES[mood]}
        alt={label ?? ''}
        aria-hidden={label ? undefined : true}
        draggable={false}
        data-mood={mood}
        className={`${className} select-none object-contain drop-shadow-[0_4px_10px_rgba(139,92,246,0.45)]`}
    />
);

export default BotFace;
