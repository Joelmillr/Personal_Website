import React from 'react';

type ButtonProps = {
    buttonText: string;
    link: string;
};

export function ContactButton({ buttonText, link }: ButtonProps) {
    return (
        <a
            href={link}
            target="_blank"
            rel="nlinkner noreferrer"
            className="mx-3 bg-black hover:bg-white hover:text-black border border-black text-white font-bold py-3 px-12 lg:px-8 duration-200 transition-colors mb-6 lg:mb-0 inline-block text-center"
        >
            {buttonText}
        </a>
    );
}

export default ContactButton;