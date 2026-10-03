import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const Section = ({ title, children }) => (
  <section className="space-y-2">
    <h2 className="text-lg font-bold">{title}</h2>
    <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
  </section>
);

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link to="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary" data-testid="privacy-back-link">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <div>
          <h1 className="text-3xl font-black tracking-tight">Privacy Policy</h1>
          <p className="mt-1 text-sm text-muted-foreground">Last updated: October 2026</p>
        </div>

        <p className="text-sm leading-relaxed">
          This app ("Load and Recovery Monitoring") helps sports teams track athlete wellness, training load,
          and recovery. This page explains what information is collected, who can see it, and how it is kept.
        </p>

        <Section title="What we collect">
          <ul className="list-disc space-y-1 pl-5">
            <li>Name, and the team(s) an athlete belongs to.</li>
            <li>Daily check-in answers: sleep, hydration, mood, illness, muscle soreness, and training session details (type, duration, effort).</li>
            <li>For coaches and team admins: an email address and password (stored only as a secure hash, never in plain text).</li>
            <li>If GPS session data is uploaded by a coach, the training-load figures included in that upload.</li>
          </ul>
        </Section>

        <Section title="Who can see it">
          <p>
            An athlete's own check-in data is visible to that athlete, to the coaches/admins of their own team, and
            to no one else. Coaches and admins can see the data of athletes on their own team only. Team data is
            not shared between different teams using this app.
          </p>
        </Section>

        <Section title="Why we collect it">
          <p>
            Solely to help coaches and medical staff monitor athlete wellbeing and manage training load safely.
            We do not sell data, and we do not use it for advertising.
          </p>
        </Section>

        <Section title="Athletes under 18">
          <p>
            Many users of this app are youth athletes. A parent or guardian, or the team's coach acting on the
            team's behalf, should review this policy before a young athlete starts using the app. If you are a
            parent or guardian and want to review, correct, or delete a young athlete's data, contact us using
            the details below.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            Data is kept for as long as the team remains active on the app, so coaches can review season-long
            trends. A team admin can request deletion of an athlete's data, or of an entire team's data, at any
            time (see Contact below).
          </p>
        </Section>

        <Section title="Your choices">
          <ul className="list-disc space-y-1 pl-5">
            <li>Athletes and admins can change their own password at any time from within the app.</li>
            <li>You can ask us to export or delete your data at any time by contacting us.</li>
            <li>Uninstalling the app does not delete your data from our servers; please contact us to request deletion.</li>
          </ul>
        </Section>

        <Section title="Contact">
          <p>
            For any question about this policy, or to request a copy or deletion of your data, contact:{" "}
            <a href="mailto:disharthjain98@gmail.com" className="font-semibold text-primary">disharthjain98@gmail.com</a>.
          </p>
        </Section>

        <p className="pt-4 text-xs text-muted-foreground">
          This policy is a plain-language summary provided for transparency and app store compliance. It is not
          a substitute for legal advice; if this app is offered more widely, consider having it reviewed by a
          lawyer familiar with data protection law in the regions your users are in.
        </p>
      </div>
    </div>
  );
}
