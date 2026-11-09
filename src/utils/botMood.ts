/**
 * Guess how EchoBot should feel about a finished reply, from the user's message and
 * the reply text. Deliberately simple keyword rules: instant, free, works offline, and
 * never changes what the AI says.
 */
export type BotMood = 'excited' | 'happy' | 'surprised' | 'curious' | 'sad' | 'neutral';

const has = (text: string, words: RegExp) => words.test(text);

const SAD = /\b(sorry to hear|i'?m (so )?sorry|unfortunately|condolences|passed away|my sympathies|that sounds (hard|difficult|tough|rough|painful)|heartbreaking|i can'?t help with|i'?m (not able|unable) to)\b/i;
const USER_SAD = /\b(i'?m (so )?(sad|depressed|lonely|upset|stressed)|i feel (sad|bad|awful|terrible|down|lonely)|bad day|i failed|i lost|passed away|died)\b/i;
const THANKS = /\b(thanks?|thank you|thx|ty|appreciate (it|you)|you'?re (the best|awesome|amazing)|love (you|it|this)|good (bot|job)|well done)\b/i;
const CELEBRATE = /(\b(congratulations|congrats|well done|great job|amazing news|happy birthday|that'?s (awesome|fantastic|wonderful|great news))\b|🎉|🥳)/i;
const SURPRISE = /\b(wow|whoa|fun fact|did you know|believe it or not|surprisingly|incredibly|mind-?blowing)\b/i;
const JOKE = /(\b(haha|hehe|lol|joke|pun)\b|😄|😂|😆|😊|😁)/i;
const GREETING = /^\s*(hi|hey|hello|yo|howdy|good (morning|afternoon|evening))\b/i;

export function detectMood(userText: string | null | undefined, replyText: string | null | undefined): BotMood {
    const user = userText ?? '';
    const reply = replyText ?? '';
    if (!reply.trim()) return 'neutral';
    if (has(reply, SAD) || has(user, USER_SAD)) return 'sad';
    if (has(user, THANKS) || has(reply, CELEBRATE)) return 'excited';
    if (has(reply, SURPRISE)) return 'surprised';
    if (has(reply, JOKE) || has(user, GREETING)) return 'happy';
    if (/\?\s*$/.test(reply.trim())) return 'curious';
    return 'happy';
}

/** Mood for the small reply avatar, which only knows the reply itself. */
export function replyFaceMood(replyText: string): 'happy' | 'neutral' {
    return has(replyText, SAD) ? 'neutral' : 'happy';
}
