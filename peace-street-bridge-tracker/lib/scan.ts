import { Resend } from "resend";
import { scanNews } from "@/lib/news";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function runScan() {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase environment variables are not configured.");

  const items = await scanNews();
  let inserted = 0;

  for (const item of items) {
    const { data, error } = await supabase
      .from("bridge_reports")
      .upsert(
        {
          title: item.title,
          source_url: item.link,
          source_name: item.sourceName,
          published_at: item.publishedAt,
          status: "candidate",
        },
        { onConflict: "source_url", ignoreDuplicates: true },
      )
      .select("id");
    if (error) throw error;
    if (data?.length) inserted += data.length;
  }

  if (inserted > 0 && process.env.RESEND_API_KEY && process.env.ALERT_EMAIL) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.ALERT_FROM_EMAIL || "Bridge Tracker <onboarding@resend.dev>",
      to: process.env.ALERT_EMAIL,
      subject: `${inserted} new Peace Street Bridge report${inserted === 1 ? "" : "s"} to review`,
      html: `<p>The tracker found ${inserted} new news candidate${inserted === 1 ? "" : "s"}.</p><p>Open the app's <strong>/admin</strong> page to confirm or reject them.</p>`,
    });
  }

  return { scanned: items.length, inserted };
}
