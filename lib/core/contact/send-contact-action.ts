'use server';

import { Config, Effect } from 'effect';
import { Email } from '@/lib/services/email/live-layer';
import { AppLayer } from '@/lib/layers';

type ContactFormData = {
  name: string;
  email: string;
  message: string;
};

export async function sendContactAction(
  data: ContactFormData
): Promise<{ success: boolean; message: string }> {
  const program = Effect.gen(function* () {
    const email = yield* Email;
    const emailSender = yield* Config.string('EMAIL_SENDER');
    const adminEmail = yield* Config.string('ADMIN_EMAIL');

    yield* email.sendEmail({
      from: emailSender,
      to: adminEmail,
      subject: `Kostnad: Access request from ${data.name}`,
      text: `Name: ${data.name}\nEmail: ${data.email}\n\nMessage:\n${data.message}`,
      html: `
        <h2>New Access Request</h2>
        <p><strong>Name:</strong> ${data.name}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <h3>Message:</h3>
        <p>${data.message.replace(/\n/g, '<br>')}</p>
      `
    });

    return { success: true as const, message: "Message sent! I'll get back to you soon." };
  }).pipe(
    Effect.withSpan('action.contact.send'),
    Effect.provide(AppLayer),
    Effect.scoped,
    Effect.catchAll(error =>
      Effect.succeed({
        success: false as const,
        message: `Failed to send message: ${String(error)}`
      })
    )
  );

  return Effect.runPromise(program);
}
