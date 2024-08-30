export type MediaItem = {
  type: 'image' | 'video';
  src: string;
  alt: string;
  description: string;
};

export const media: MediaItem[] = [
    {
        type: 'image',
        src: '/me-photos/meinquebec.png',
        alt: 'Me in Quebec',
        description: 'A chilly day exploring the historic streets of Quebec during the winter. The snow-covered landscape adds a serene and beautiful backdrop to this adventure.',
    },
    {
        type: 'image',
        src: '/me-photos/meinportugal.JPG',
        alt: 'Me in Portugal',
        description: 'Standing at the edge of Europe at Cabo da Roca, Portugal. The breathtaking cliffs and powerful ocean waves made this a truly unforgettable experience.',
    },
    {
        type: 'image',
        src: '/me-photos/merunningtriatholon.JPG',
        alt: 'Me Running Triathlon',
        description: 'Captured mid-stride during my first triathlon. This moment marked the culmination of months of training and personal growth.',
    },
    // {
    //     type: 'image',
    //     src: '/me-photos/meinportugal2.jpg',
    //     alt: 'Me in Portugal 2',
    //     description: 'Another perspective from the rugged coastlines of Portugal. The sheer cliffs and expansive ocean views were awe-inspiring.',
    // },
    {
        type: 'image',
        src: '/me-photos/meandturtle.png',
        alt: 'Me and Turtle',
        description: 'A close encounter with a friendly turtle during a day out at the cottage. A rare and memorable connection with nature.',
    },
    // {
    //     type: 'image',
    //     src: '/me-photos/canoeing.png',
    //     alt: 'Canoeing',
    //     description: 'A serene moment captured during a portage while canoeing through the Algonquin wilderness. The calm water and lush surroundings embody the peace of nature.',
    // },
    {
        type: 'image',
        src: '/me-photos/meandluna.png',
        alt: 'Me and Luna',
        description: 'Luna and I lounging in bed.',
    },
    {
        type: 'image',
        src: '/me-photos/mewithdizzyglasses.png',
        alt: 'Me with Dizzy Glasses',
        description: 'Trying out glasses my mom bought for our cruise to fight seasickness, I do not think they worked.',
    },
    {
        type: 'video',
        src: '/me-photos/slomorusty.mp4',
        alt: 'Slow Motion Rusty',
        description: 'Rusty in slow motion, capturing his playful side in detail.',
    },
    //   {
    //     type: 'video',
    //     src: '/me-photos/rustywithball.mp4',
    //     alt: 'Rusty with Ball',
    //     description: 'Rusty playing with his favorite ball, always full of energy.',
    //   },
    //   {
    //     type: 'video',
    //     src: '/me-photos/rustywithball2.mp4',
    //     alt: 'Rusty with Ball 2',
    //     description: 'Another clip of Rusty having the time of his life with his ball.',
    //   },
];