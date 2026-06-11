export type Message = {
  id: string;
  text: string;
  fromMe: boolean;
  sentAt: Date;
};

export type Conversation = {
  listingId: string;
  messages: Message[];
};

// In-memory store — replace with a real backend (Firebase/Supabase) for production
const store = new Map<string, Message[]>();

export function getMessages(listingId: string): Message[] {
  if (!store.has(listingId)) {
    // Seed with a starter message from the seller
    store.set(listingId, [
      {
        id: 'seed-1',
        text: 'Hej! Ja, biljetten finns kvar 🙂 Vad undrar du?',
        fromMe: false,
        sentAt: new Date(Date.now() - 1000 * 60 * 2),
      },
    ]);
  }
  return store.get(listingId)!;
}

export function sendMessage(listingId: string, text: string): Message {
  const msg: Message = {
    id: `msg-${Date.now()}`,
    text,
    fromMe: true,
    sentAt: new Date(),
  };

  const msgs = getMessages(listingId);
  msgs.push(msg);

  // Simulate a seller reply after a short delay
  setTimeout(() => {
    const replies = [
      'Okej, låter bra!',
      'Absolut, vi kan mötas i centrala Lund.',
      'Swish funkar bra för mig.',
      'Perfekt! Hör av dig så fixar vi det.',
      'Ja det stämmer, pris är som annonserat.',
    ];
    msgs.push({
      id: `msg-reply-${Date.now()}`,
      text: replies[Math.floor(Math.random() * replies.length)],
      fromMe: false,
      sentAt: new Date(),
    });
  }, 1200 + Math.random() * 1000);

  return msg;
}
