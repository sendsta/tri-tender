import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = 'Tri-Tender <notifications@tri-tender.co.za>'

export async function sendTenderReceived(email: string, tenderTitle: string) {
  if (!process.env.RESEND_API_KEY) return
  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: `Tender received: ${tenderTitle}`,
      html: `
        <h2>Tender Received</h2>
        <p>Your tender <strong>${tenderTitle}</strong> has been received and is being processed.</p>
        <p>You can track progress in your <a href="${process.env.NEXT_PUBLIC_APP_URL}/tenders">Tri-Tender portal</a>.</p>
        <p>— Tri-Tender Team</p>
      `,
    })
  } catch (err) {
    console.error('[email] Failed to send tender received:', err)
  }
}

export async function sendQuoteReady(email: string, tenderTitle: string, amountCents: number) {
  if (!process.env.RESEND_API_KEY) return
  const amount = (amountCents / 100).toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR' })
  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: `Quote ready: ${tenderTitle} — ${amount}`,
      html: `
        <h2>Your Quote is Ready</h2>
        <p>A quote of <strong>${amount}</strong> has been prepared for <strong>${tenderTitle}</strong>.</p>
        <p>Review and accept it in your <a href="${process.env.NEXT_PUBLIC_APP_URL}/tenders">Tri-Tender portal</a>.</p>
        <p>— Tri-Tender Team</p>
      `,
    })
  } catch (err) {
    console.error('[email] Failed to send quote ready:', err)
  }
}

export async function sendPaymentConfirmed(email: string, tenderTitle: string, amountCents: number) {
  if (!process.env.RESEND_API_KEY) return
  const amount = (amountCents / 100).toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR' })
  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: `Payment confirmed: ${amount} for ${tenderTitle}`,
      html: `
        <h2>Payment Confirmed</h2>
        <p>Your payment of <strong>${amount}</strong> for <strong>${tenderTitle}</strong> has been confirmed.</p>
        <p>Processing will continue automatically. Track progress in your <a href="${process.env.NEXT_PUBLIC_APP_URL}/tenders">portal</a>.</p>
        <p>— Tri-Tender Team</p>
      `,
    })
  } catch (err) {
    console.error('[email] Failed to send payment confirmed:', err)
  }
}

export async function sendTenderBlocked(email: string, tenderTitle: string, reason: string) {
  if (!process.env.RESEND_API_KEY) return
  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: `Action required: ${tenderTitle} is blocked`,
      html: `
        <h2>Tender Blocked — Action Required</h2>
        <p>Your tender <strong>${tenderTitle}</strong> requires attention:</p>
        <p><em>${reason}</em></p>
        <p>Please check your <a href="${process.env.NEXT_PUBLIC_APP_URL}/tenders">portal</a> for details on missing items.</p>
        <p>— Tri-Tender Team</p>
      `,
    })
  } catch (err) {
    console.error('[email] Failed to send tender blocked:', err)
  }
}

export async function sendPackReady(email: string, tenderTitle: string) {
  if (!process.env.RESEND_API_KEY) return
  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: `Submission pack ready: ${tenderTitle}`,
      html: `
        <h2>Submission Pack Ready</h2>
        <p>The submission pack for <strong>${tenderTitle}</strong> is complete and ready for download.</p>
        <p>Download it from your <a href="${process.env.NEXT_PUBLIC_APP_URL}/tenders">Tri-Tender portal</a>.</p>
        <p>— Tri-Tender Team</p>
      `,
    })
  } catch (err) {
    console.error('[email] Failed to send pack ready:', err)
  }
}

export async function sendActivationConfirmed(email: string, companyName: string) {
  if (!process.env.RESEND_API_KEY) return
  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: `Welcome to Tri-Tender — ${companyName} activated`,
      html: `
        <h2>Account Activated</h2>
        <p>Welcome! <strong>${companyName}</strong> is now active on Tri-Tender.</p>
        <p>You can now upload tenders and start processing. Visit your <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard">dashboard</a> to get started.</p>
        <p>— Tri-Tender Team</p>
      `,
    })
  } catch (err) {
    console.error('[email] Failed to send activation confirmed:', err)
  }
}
