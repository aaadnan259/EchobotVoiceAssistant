import { describe, it, expect } from 'vitest';
import { detectMood, replyFaceMood } from './botMood';

describe('detectMood', () => {
    it.each([
        ['thanks so much!', "You're welcome! Happy to help.", 'excited'],
        ['I got the job', 'Congratulations! That is wonderful news.', 'excited'],
        ['my dog passed away', 'I am so sorry for your loss. That sounds really hard.', 'sad'],
        ['can you hack my ex', "Unfortunately I can't help with that.", 'sad'],
        ['tell me something cool', 'Fun fact: octopuses have three hearts.', 'surprised'],
        ['tell me a joke', 'Why did the robot cross the road? Haha, to recharge!', 'happy'],
        ['hello', 'Hi there! Nice to meet you.', 'happy'],
        ['plan my trip', 'Sure. Where would you like to go?', 'curious'],
        ['what is 2+2', '2 + 2 = 4.', 'happy'],
    ])('%s -> %s', (user, reply, mood) => {
        expect(detectMood(user, reply)).toBe(mood);
    });

    it('stays neutral for an empty reply', () => {
        expect(detectMood('hi', '   ')).toBe('neutral');
        expect(detectMood(null, undefined)).toBe('neutral');
    });

    it('does not trip on words that merely contain a keyword', () => {
        expect(detectMood('analyze this', 'Thanksgiving is in November.')).toBe('happy');
        expect(detectMood('x', 'The tyrant fell.')).toBe('happy');
    });
});

describe('replyFaceMood', () => {
    it('smiles normally but not on sad replies', () => {
        expect(replyFaceMood('Here you go!')).toBe('happy');
        expect(replyFaceMood("I'm so sorry to hear that.")).toBe('neutral');
    });
});
