'use server';

// TODO: Send to Telegram when bot is set up
// For now, just log and return success

export async function joinWaitlistAction(
  email: string
): Promise<{ success: boolean; message: string }> {
  // Basic validation
  if (!email || !email.includes('@')) {
    return { success: false, message: 'Please enter a valid email address.' };
  }

  // Log for now - will integrate with Telegram later
  console.log(`[Waitlist] New signup: ${email}`);

  return {
    success: true,
    message: "You're on the list! We'll notify you when we launch."
  };
}
