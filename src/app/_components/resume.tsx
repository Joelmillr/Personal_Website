"use client";

import React from 'react';

export function Resume() {
    const openPdfInNewTab = () => {
        window.open('/Resume.pdf', '_blank');
    };

    return (
        <div className="flex justify-center">
            <button 
                className="mx-3 bg-black hover:bg-white hover:text-black border border-black text-white font-bold py-3 px-12 lg:px-8 duration-200 transition-colors mb-6 lg:mb-0" 
                onClick={openPdfInNewTab}
            >
                Checkout my resume!
            </button>
        </div>
    );
};

export default Resume;