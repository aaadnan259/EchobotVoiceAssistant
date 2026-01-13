import React from 'react';

// This was likely a wrapper for the 3D canvas or visualizer context
// For now, we'll keep it simple as a pass-through or placeholder
// based on how Orb.tsx handles the actual visual.

const OrbCanvas: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <div className="relative w-full h-[300px] flex items-center justify-center">
            {children}
        </div>
    );
};

export default OrbCanvas;
