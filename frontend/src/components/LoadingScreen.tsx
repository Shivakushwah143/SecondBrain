import React from 'react';

interface LoadingScreenProps {
  title: string;
  subtitle: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ title, subtitle }) => {
  return (
    <div className="min-h-screen bg-[#E7DED2] dark:bg-[#1B1F2A] flex items-center justify-center">
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-6">
          <span className="h-3 w-3 rounded-full bg-[#B35A3C] dark:bg-[#1E5A58] animate-bounce [animation-delay:0ms]" />
          <span className="h-3 w-3 rounded-full bg-[#A46A3B] dark:bg-[#5FA3A6] animate-bounce [animation-delay:120ms]" />
          <span className="h-3 w-3 rounded-full bg-[#7C4D7A] dark:bg-[#C08AA6] animate-bounce [animation-delay:240ms]" />
        </div>
        <p className="text-[#323845] dark:text-[#C7D0DD] font-medium text-lg">{title}</p>
        <p className="text-[#6B7481] dark:text-[#8D95A3] mt-2">{subtitle}</p>
      </div>
    </div>
  );
};

export default LoadingScreen;






